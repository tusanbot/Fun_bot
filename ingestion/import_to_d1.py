"""Import Telegram Desktop JSON/HTML history into the configured Cloudflare D1 database.

Run from the repository root. This script calls Wrangler for each bounded SQL batch;
it never sends the exported history to an external AI provider.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Iterable

from import_export import normalize_html, normalize_json


def sql(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        value = int(value)
    return "'" + str(value).replace("'", "''") + "'"


def statements_for(record: dict[str, Any], chat_id: str) -> list[str]:
    message_id = str(record.get("telegram_message_id") or "").strip()
    if not message_id:
        return []
    sender_id = record.get("sender_id")
    sender = str(record.get("sender") or "").strip() or None
    date = record.get("date")
    text = str(record.get("text") or "")
    reply_to = record.get("reply_to_message_id")
    statements: list[str] = []

    if sender_id is not None and str(sender_id).strip():
        statements.append(
            "INSERT INTO users (chat_id, user_id, display_name, username) VALUES "
            f"({sql(chat_id)}, {sql(str(sender_id))}, {sql(sender)}, NULL) "
            "ON CONFLICT(chat_id, user_id) DO UPDATE SET "
            "display_name = COALESCE(users.display_name, excluded.display_name);"
        )

    statements.append(
        "INSERT INTO messages "
        "(chat_id, telegram_message_id, user_id, message_date, text_content, reply_to_message_id, source) VALUES "
        f"({sql(chat_id)}, {sql(message_id)}, {sql(str(sender_id) if sender_id is not None else None)}, "
        f"{sql(date)}, {sql(text)}, {sql(str(reply_to) if reply_to is not None else None)}, "
        "'telegram_desktop_export') "
        "ON CONFLICT(chat_id, telegram_message_id) DO UPDATE SET "
        "text_content = CASE WHEN messages.text_content IS NULL OR trim(messages.text_content) = '' "
        "THEN excluded.text_content ELSE messages.text_content END, "
        "message_date = COALESCE(messages.message_date, excluded.message_date);"
    )
    return statements


def records_from(path: Path) -> Iterable[dict[str, Any]]:
    suffix = path.suffix.lower()
    if suffix == ".json":
        return normalize_json(path)
    if suffix in {".html", ".htm"}:
        return normalize_html(path)
    raise ValueError("Input must be a Telegram Desktop .json or .html export")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Telegram Desktop result.json or messages.html")
    parser.add_argument("--chat-id", required=True, help="Target Telegram group ID, e.g. -1001234567890")
    parser.add_argument("--chat-title", required=True, help="Exact group title shown in Telegram")
    parser.add_argument("--database", default="fun", help="D1 database name from wrangler.toml (default: fun)")
    parser.add_argument("--batch-size", type=int, default=40, help="Messages per Wrangler batch (default: 40)")
    parser.add_argument("--remote", action="store_true", help="Required confirmation to import into production D1")
    parser.add_argument("--dry-run", action="store_true", help="Generate and count SQL without changing D1")
    args = parser.parse_args()

    if not args.input.is_file():
        parser.error(f"Input file not found: {args.input}")
    if not args.remote and not args.dry_run:
        parser.error("Pass --remote to import into production D1, or --dry-run to preview.")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", args.database):
        parser.error("Invalid D1 database name.")
    if not 1 <= args.batch_size <= 100:
        parser.error("--batch-size must be between 1 and 100.")
    if not args.chat_id.strip() or not args.chat_title.strip():
        parser.error("--chat-id and --chat-title cannot be empty.")

    records = records_from(args.input)
    all_statements: list[str] = []
    seen = 0
    for record in records:
        seen += 1
        all_statements.extend(statements_for(record, args.chat_id.strip()))

    # D1 group metadata is created before message/user rows; FK references remain valid.
    group_sql = (
        "INSERT INTO groups (chat_id, title, updated_at) VALUES "
        f"({sql(args.chat_id.strip())}, {sql(args.chat_title.strip())}, datetime('now')) "
        "ON CONFLICT(chat_id) DO UPDATE SET title = excluded.title, updated_at = datetime('now');"
    )

    message_statements = all_statements
    chunks = [
        message_statements[i : i + args.batch_size * 2]
        for i in range(0, len(message_statements), args.batch_size * 2)
    ]
    # Statements can be 1 or 2 per message; chunks are bounded conservatively.
    print(f"Export records read: {seen}")
    print(f"SQL statements prepared: {len(all_statements)}")
    print(f"SQL batches: {len(chunks) + 1}")
    if args.dry_run:
        print("Dry run only: D1 was not changed.")
        return

    with tempfile.TemporaryDirectory(prefix="fun-bot-import-") as tmp:
        files: list[Path] = []
        first = Path(tmp) / "000_group.sql"
        first.write_text(group_sql + "\n", encoding="utf-8")
        files.append(first)
        for index, chunk in enumerate(chunks, start=1):
            sql_file = Path(tmp) / f"{index:04d}_messages.sql"
            sql_file.write_text("\n".join(chunk) + "\n", encoding="utf-8")
            files.append(sql_file)

        for index, sql_file in enumerate(files, start=1):
            command = (
                f'npx wrangler d1 execute {args.database} --remote --file="{sql_file}"'
            )
            print(f"[{index}/{len(files)}] Applying {sql_file.name} ...", flush=True)
            subprocess.run(command, shell=True, check=True)

    print("Import completed. Existing messages were deduplicated by (chat_id, telegram_message_id).")


if __name__ == "__main__":
    main()
