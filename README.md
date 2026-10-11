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

### واردسازی تاریخچه قدیمی گروه مستقیماً از تلگرام

این قابلیت داخل Cloudflare Worker اجرا می‌شود؛ برای واردسازی تاریخچه لازم نیست Python، Wrangler یا مخزن را روی کامپیوتر اجرا کنی.

1. در گروه مقصد دستور `/history` را بفرست. ربات این درخواست را به حساب تلگرامی تو و همان گروه متصل می‌کند و ۳۰ دقیقه اعتبار دارد.
2. در **Telegram Desktop** منوی گروه را باز کن و **Export chat history** را انتخاب کن. فرمت **JSON** را انتخاب و فایل `result.json` را ذخیره کن.
3. فایل JSON را در گفتگوی خصوصی با همین ربات به‌صورت سند (Document) ارسال کن؛ خود فایل را به گروه نفرست.
4. Worker فایل را از Telegram Bot API دریافت می‌کند، پیام‌ها را دسته‌ای به D1 وارد می‌کند و گزارش تعداد پیام‌های پردازش‌شده و بسته‌های ناموفق را در گفتگوی خصوصی می‌فرستد.
5. پس از پایان واردسازی، ربات می‌تواند متن پیام‌های موجود در فایل را در پاسخ‌های گروه جست‌وجو کند.

**محدودیت‌ها و امنیت**
- فقط فایل JSON خروجی Telegram Desktop پشتیبانی می‌شود؛ سقف حجم فعلی حدود ۱۹ مگابایت است.
- درخواست واردسازی فقط برای حسابی که دستور `/history` را در گروه فرستاده و فقط تا ۳۰ دقیقه معتبر است.
- پیام‌های تکراری با شناسه گروه و شناسه پیام یکتا شناسایی می‌شوند؛ اطلاعات گروه‌های دیگر با گروه مقصد مخلوط نمی‌شوند.
- پیام‌هایی که در خروجی متن یا کپشن ندارند، برای جست‌وجوی متنی قابل استفاده نیستند.
- قبل از ارسال، فایل خروجی را بررسی کن؛ Worker محتوای تاریخچه را برای واردسازی در دیتابیس خود پروژه ذخیره می‌کند.
