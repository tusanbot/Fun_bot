-- Initial schema migration. Kept in sync with schema.sql for local setup.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS groups (
  chat_id TEXT PRIMARY KEY,
  title TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT,
  username TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (chat_id, user_id),
  FOREIGN KEY (chat_id) REFERENCES groups(chat_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  telegram_message_id TEXT NOT NULL,
  user_id TEXT,
  message_date TEXT,
  text_content TEXT,
  reply_to_message_id TEXT,
  source TEXT NOT NULL DEFAULT 'live',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (chat_id, telegram_message_id),
  FOREIGN KEY (chat_id) REFERENCES groups(chat_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_date ON messages(chat_id, message_date);
CREATE INDEX IF NOT EXISTS idx_messages_chat_user_date ON messages(chat_id, user_id, message_date);
CREATE INDEX IF NOT EXISTS idx_messages_chat_reply ON messages(chat_id, reply_to_message_id);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  text_content, content='messages', content_rowid='id', tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, text_content) VALUES (new.id, new.text_content);
END;
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, text_content)
  VALUES ('delete', old.id, old.text_content);
END;
CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE OF text_content ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, text_content)
  VALUES ('delete', old.id, old.text_content);
  INSERT INTO messages_fts(rowid, text_content) VALUES (new.id, new.text_content);
END;
