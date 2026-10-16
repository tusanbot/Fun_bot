-- Persist labels for Reply Keyboard buttons so ordinary text messages can route to existing actions.
CREATE TABLE IF NOT EXISTS reply_keyboard_actions (
  chat_id TEXT NOT NULL,
  button_text TEXT NOT NULL,
  callback_data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (chat_id, button_text)
);
CREATE INDEX IF NOT EXISTS idx_reply_keyboard_actions_updated
  ON reply_keyboard_actions(chat_id, updated_at);
