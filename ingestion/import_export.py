"""Normalize Telegram Desktop JSON/HTML exports into JSON Lines.

This utility does not upload data. Review the output before importing it into a database.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any, Iterable

from bs4 import BeautifulSoup


def flatten_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "".join(parts)
    return ""


def iso_date(value: Any) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()
    except ValueError:
        return None


def normalize_json(source: Path) -> Iterable[dict[str, Any]]:
    payload = json.loads(source.read_text(encoding="utf-8"))
    chat = payload.get("name") or payload.get("id") or source.stem
    for message in payload.get("messages", []):
        if not isinstance(message, dict) or message.get("type") != "message":
            continue
        text = flatten_text(message.get("text"))
        yield {
            "source_chat": str(chat),
            "telegram_message_id": str(message.get("id", "")),
            "sender": message.get("from"),
            "sender_id": str(message["from_id"]) if message.get("from_id") is not None else None,
            "date": iso_date(message.get("date")),
            "text": text,
            "reply_to_message_id": (
                str(message["reply_to_message_id"])
                if message.get("reply_to_message_id") is not None
                else None
            ),
            "source": "telegram_desktop_export",
        }


def normalize_html(source: Path) -> Iterable[dict[str, Any]]:
    soup = BeautifulSoup(source.read_text(encoding="utf-8"), "html.parser")
    chat_title = soup.select_one(".page_header .text")
    chat = chat_title.get_text(" ", strip=True) if chat_title else source.stem

    for node in soup.select(".message.default, .message.service"):
        raw_id = node.get("id", "")
        match = re.search(r"message(\d+)", raw_id)
        if not match:
            continue
        sender_node = node.select_one(".from_name")
        text_node = node.select_one(".text")
        date_node = node.select_one(".date")
        timestamp = date_node.get("title") if date_node else None
        text = unescape(text_node.get_text("\n", strip=True)) if text_node else ""
        yield {
            "source_chat": str(chat),
            "telegram_message_id": match.group(1),
            "sender": sender_node.get_text(" ", strip=True) if sender_node else None,
            "sender_id": None,
            "date": iso_date(timestamp),
            "text": text,
            "reply_to_message_id": None,
            "source": "telegram_desktop_export",
        }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Telegram Desktop result.json or messages.html")
    parser.add_argument("-o", "--output", type=Path, required=True, help="Output JSONL path")
    args = parser.parse_args()

    suffix = args.input.suffix.lower()
    if suffix == ".json":
        records = normalize_json(args.input)
    elif suffix in {".html", ".htm"}:
        records = normalize_html(args.input)
    else:
        parser.error("Input must be a Telegram Desktop .json or .html export")

    count = 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as output:
        for record in records:
            output.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1
    print(f"Normalized {count} messages to {args.output}")


if __name__ == "__main__":
    main()
