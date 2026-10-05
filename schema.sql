CREATE TABLE IF NOT EXISTS guild_config (
  guild_id       TEXT PRIMARY KEY,
  channel_id     TEXT NOT NULL,
  role_id        TEXT,
  lead_min       INTEGER NOT NULL DEFAULT 10,
  include_frequent INTEGER NOT NULL DEFAULT 0
);
