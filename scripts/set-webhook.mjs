const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.WEBHOOK_SECRET;
const webhookUrl = process.env.WEBHOOK_URL || "https://fun-bot.mshmahyar9.workers.dev/webhook";

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  process.exit(1);
}
if (!secret) {
  console.error("Missing WEBHOOK_SECRET environment variable.");
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  console.error("WEBHOOK_SECRET must be 1–256 characters and contain only A-Z, a-z, 0-9, _ or -.");
  process.exit(1);
}
if (!webhookUrl.startsWith("https://")) {
  console.error("WEBHOOK_URL must be an HTTPS URL.");
  process.exit(1);
}

async function telegram(method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(`${method} failed: ${result.description || response.status}`);
  }
  return result.result;
}

try {
  await telegram("setWebhook", {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message", "edited_message", "callback_query"],
    drop_pending_updates: false,
  });

  const info = await telegram("getWebhookInfo");
  const allowed = info.allowed_updates || [];
  const callbackEnabled = allowed.includes("callback_query");
  console.log("Webhook configured:", info.url);
  console.log("Allowed updates:", allowed.join(", "));
  if (!callbackEnabled) {
    console.error("Verification failed: callback_query is not enabled.");
    process.exitCode = 1;
  } else {
    console.log("Verified: inline keyboard callbacks are enabled.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Webhook setup failed.");
  process.exitCode = 1;
}
