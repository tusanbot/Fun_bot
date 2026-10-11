# History ingestion

The importer will support Telegram Desktop exports in JSON and HTML formats.

## Planned behavior

- Normalize export records into a stable internal message shape.
- Preserve source chat identity, message ID, sender, timestamp, text, and reply reference where available.
- Import in batches and use an idempotent key so retries do not duplicate records.
- Keep every record scoped to its originating chat.
- Never upload export files or session files to GitHub.

MTProto crawling uses Telethon and must run as a separate Python process outside Cloudflare Workers. It requires the account owner's explicit authorization and should only access groups that account is allowed to read.
