-- Group approval, bot settings, encrypted API key pool, and admin input sessions.
ALTER TABLE groups ADD COLUMN approved INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS bot_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL DEFAULT 'xai',
  label TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_status TEXT NOT NULL DEFAULT 'unchecked',
  last_error TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  user_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  chat_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_groups_approved ON groups(approved, enabled);
CREATE INDEX IF NOT EXISTS idx_api_keys_enabled ON api_keys(enabled, provider);
