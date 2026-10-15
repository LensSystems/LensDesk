CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE installed_tools (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  install_path TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  signed INTEGER NOT NULL CHECK (signed IN (0, 1)),
  key_id TEXT,
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE open_tabs (
  position INTEGER PRIMARY KEY,
  tool_id TEXT NOT NULL UNIQUE REFERENCES installed_tools(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1))
);

CREATE UNIQUE INDEX uq_open_tabs_active ON open_tabs(active) WHERE active = 1;

CREATE TABLE tool_kv (
  tool_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tool_id, key)
);
