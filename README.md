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
- Optionally set `GROQ_MODEL` as a Worker variable. The default is `llama-3.3-70b-versatile`.
- The bot stores eligible group messages in D1 and replies only when directly mentioned or when a user replies to one of its messages. The model receives recent text history from that same chat only.
- Telegram group privacy mode may prevent the bot from seeing regular group messages. Disable privacy mode with BotFather or grant the bot appropriate admin permissions if you intend to archive eligible group messages. Make sure group members know the retention policy.

## Current scope

This repository contains the Worker, D1 schema, history-import scaffolding, and a first Groq-powered group-answer path. Semantic search, MTProto crawling, and further production hardening remain future work.
