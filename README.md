# Fun_bot

A Telegram group-memory bot, built with a Cloudflare-first architecture.

## Architecture

- **Cloudflare Worker** receives Telegram updates through a webhook.
- **Cloudflare D1** stores group-scoped messages and metadata.
- **History importer** is a separate Python utility for Telegram Desktop JSON/HTML exports.
- **MTProto crawling** is intentionally kept outside Workers; it requires a separately run Python process and explicit authorization.
- **AI providers** will be implemented behind a shared interface so an API provider can be used first and a local model added later.

## Privacy and isolation

- Every stored message is scoped to its Telegram chat ID.
- Retrieval must always filter by chat ID; never search across groups for a group-level answer.
- Do not commit bot tokens, Telegram API credentials, Telethon session files, exports, or production database data.
- Prefer making this repository **Private** before adding implementation details or deployment configuration.

## Local development

1. Install Node.js 20+ and npm.
2. Install dependencies with `npm install`.
3. Create a D1 database and set its ID in `wrangler.toml`.
4. Copy `.dev.vars.example` to `.dev.vars` and fill in local-only values.
5. Apply the schema using `npx wrangler d1 execute fun-bot-db --local --file=./schema.sql`.
6. Run `npm run dev`.

## Telegram webhook

Set `TELEGRAM_BOT_TOKEN` as a Worker secret, then deploy and configure Telegram's webhook to point to the deployed Worker URL plus `/webhook`. Set `BOT_USERNAME` as a regular Worker variable (without the leading @).

**Important:** Telegram's default group privacy mode prevents bots from receiving most ordinary group messages. To archive all eligible group messages, disable privacy mode for the bot through BotFather or make the bot an administrator with appropriate permissions. Confirm group members understand the message-retention policy before enabling collection.

## Groq group replies

- Set `GROQ_API_KEY` as a Cloudflare Worker **Secret** (never commit the key). The same key format used by the MafiaNew Groq integration works here; this bot uses Groq's chat-completions API, not the speech-to-text endpoint.
- Optionally set `GROQ_MODEL` as a Worker variable. The default is `openai/gpt-oss-120b`.
- The bot stores eligible group messages in D1 and replies only when directly mentioned or when a user replies to one of its messages. The model receives recent text history from that same chat only.
- Telegram group privacy mode may prevent the bot from seeing regular group messages. Disable privacy mode with BotFather or grant the bot appropriate admin permissions if you intend to archive eligible group messages. Make sure group members know the retention policy.

## Current scope

This repository contains the Worker, D1 schema, history-import scaffolding, and a first Groq-powered group-answer path. Semantic search, MTProto crawling, and further production hardening remain future work.

## تنظیم کلید API و واردسازی تاریخچه

### ثبت کلید API

- در گفتگوی خصوصی ربات دستور `/api` را بفرست؛ ربات لینک رسمی ساخت کلید Groq و مسیر تنظیم آن را نشان می‌دهد.
- کلید را از [صفحه رسمی Groq API Keys](https://console.groq.com/keys) بساز.
- در Cloudflare برو به **Workers & Pages → fun-bot → Settings → Variables and Secrets** و مقدار `GROQ_API_KEY` را به‌صورت **Secret** ثبت یا به‌روزرسانی کن، سپس نسخه Worker را Deploy کن.
- کلید را برای ربات تلگرام نفرست و در GitHub یا فایل‌های مخزن قرار نده.

### واردسازی تاریخچه قدیمی گروه

1. در گروه تلگرام دستور `/history` را بفرست تا شناسه گروه را ببینی.
2. در **Telegram Desktop** منوی همان گروه را باز کن و **Export chat history** را انتخاب کن. خروجی **JSON** توصیه می‌شود؛ خروجی HTML نیز پشتیبانی می‌شود. این قابلیت در برنامه دسکتاپ تلگرام است، نه نسخه وب. [راهنمای تلگرام](https://bugs.telegram.org/c/60/3)
3. فایل خروجی را روی کامپیوتر نگه دار و مخزن `Fun_bot` را در همان کامپیوتر باز کن.
4. در PowerShell، از پوشه اصلی مخزن وابستگی واردکننده را نصب کن:
   ```powershell
   py -m pip install -e ingestion
   ```
5. با شناسه‌ای که دستور `/history` نشان داده، واردسازی را اجرا کن. مسیر فایل و نام گروه را مطابق خروجی خودت تغییر بده:
   ```powershell
   py ingestion/import_to_d1.py "C:\Users\YourName\Downloads\result.json" --chat-id "-1001234567890" --chat-title "نام گروه" --remote
   ```
6. اسکریپت با Wrangler، پیام‌ها را دسته‌ای به دیتابیس D1 اصلی وارد می‌کند. اگر همان شناسه پیام قبلاً وجود داشته باشد، دوباره ثبت نمی‌شود و متن زنده موجود بی‌دلیل جایگزین نخواهد شد. برای آزمایش بدون تغییر دیتابیس، ابتدا `--remote` را با `--dry-run` جایگزین کن.

**مهم:** پیش از اجرای واردسازی روی `--remote`، از فایل خروجی نسخه پشتیبان نگه دار و مطمئن شو شناسه گروه درست است. پیام‌های بدون متن (مثل بعضی عکس‌ها و فایل‌ها) برای جست‌وجوی متنی مفید نیستند؛ متن و کپشن‌های موجود وارد می‌شوند. پیام‌های واردشده در دیتابیس همان گروه ذخیره می‌شوند و تاریخچه گروه‌های دیگر به آن اضافه نمی‌شود.
