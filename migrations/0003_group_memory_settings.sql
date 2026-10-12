-- Per-group memory controls and API keys.
ALTER TABLE groups ADD COLUMN memory_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE groups ADD COLUMN max_messages INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE groups ADD COLUMN retention_days INTEGER NOT NULL DEFAULT 365;
ALTER TABLE api_keys ADD COLUMN chat_id TEXT;

CREATE INDEX IF NOT EXISTS idx_api_keys_chat_enabled
ON api_keys(chat_id, enabled);
