interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  BOT_USERNAME: string;
}

interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  title?: string;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  from?: TelegramUser;
  chat: TelegramChat;
  reply_to_message?: {
    message_id: number;
    from?: TelegramUser;
  };
}

interface TelegramUpdate {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

async function telegramApi<T>(
  env: Env,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(`Telegram API request failed: ${method} (${response.status})`);
  }

  const payload = (await response.json()) as { ok: boolean; result: T; description?: string };
  if (!payload.ok) {
    throw new Error(payload.description ?? `Telegram API error: ${method}`);
  }
  return payload.result;
}

function isExplicitlyAddressed(message: TelegramMessage, botUsername: string): boolean {
  const normalizedUsername = botUsername.replace(/^@/, "").toLowerCase();
  const repliedBotUsername = message.reply_to_message?.from?.username?.toLowerCase();
  if (repliedBotUsername && repliedBotUsername === normalizedUsername) return true;

  const text = message.text ?? message.caption ?? "";
  if (!text || !botUsername) return false;

  const entities = (message as TelegramMessage & {
    entities?: Array<{ type: string; offset: number; length: number; user?: TelegramUser }>;
    caption_entities?: Array<{ type: string; offset: number; length: number; user?: TelegramUser }>;
  }).entities ?? (message as TelegramMessage & {
    caption_entities?: Array<{ type: string; offset: number; length: number; user?: TelegramUser }>;
  }).caption_entities ?? [];

  return entities.some((entity) => {
    if (entity.type !== "mention") return false;
    const mention = text.slice(entity.offset, entity.offset + entity.length);
    return mention.replace(/^@/, "").toLowerCase() === normalizedUsername;
  });
}

async function saveMessage(env: Env, message: TelegramMessage): Promise<void> {
  const chatId = String(message.chat.id);
  const userId = message.from ? String(message.from.id) : null;
  const displayName = message.from
    ? [message.from.first_name, message.from.last_name].filter(Boolean).join(" ")
    : null;
  const content = message.text ?? message.caption ?? null;

  await env.DB.prepare(
    `INSERT INTO groups (chat_id, title, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE SET
       title = COALESCE(excluded.title, groups.title),
       updated_at = datetime('now')`,
  ).bind(chatId, message.chat.title ?? null).run();

  if (message.from && !message.from.is_bot) {
    await env.DB.prepare(
      `INSERT INTO users (chat_id, user_id, display_name, username)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(chat_id, user_id) DO UPDATE SET
         display_name = excluded.display_name,
         username = excluded.username`,
    ).bind(chatId, userId, displayName, message.from.username ?? null).run();
  }

  await env.DB.prepare(
    `INSERT INTO messages
      (chat_id, telegram_message_id, user_id, message_date, text_content, reply_to_message_id, source)
     VALUES (?, ?, ?, ?, ?, ?, 'live')
     ON CONFLICT(chat_id, telegram_message_id) DO UPDATE SET
       text_content = COALESCE(excluded.text_content, messages.text_content)`,
  ).bind(
    chatId,
    String(message.message_id),
    userId,
    new Date(message.date * 1000).toISOString(),
    content,
    message.reply_to_message ? String(message.reply_to_message.message_id) : null,
  ).run();
}

async function handleUpdate(env: Env, update: TelegramUpdate): Promise<void> {
  const message = update.message ?? update.edited_message;
  if (!message || message.chat.type === "private") return;

  await saveMessage(env, message);

  // AI retrieval/answer generation is added in a later milestone.
  // Do not respond to ordinary group messages.
  if (!isExplicitlyAddressed(message, env.BOT_USERNAME)) return;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({ service: "Fun_bot", status: "ok" });
    }

    if (request.method !== "POST" || url.pathname !== "/webhook") {
      return new Response("Not found", { status: 404 });
    }

    const suppliedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (!env.WEBHOOK_SECRET || suppliedSecret !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update: TelegramUpdate;
    try {
      update = (await request.json()) as TelegramUpdate;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    try {
      await handleUpdate(env, update);
      return Response.json({ ok: true });
    } catch (error) {
      console.error("Failed to process Telegram update", error);
      return new Response("Temporary processing error", { status: 500 });
    }
  },
};
