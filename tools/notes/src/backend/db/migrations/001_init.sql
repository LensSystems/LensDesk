CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_notes_list ON notes(deleted_at, pinned, updated_at);

CREATE VIRTUAL TABLE notes_fts USING fts5(
  title,
  body_md,
  content = 'notes',
  content_rowid = 'rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, body_md) VALUES (new.rowid, new.title, new.body_md);
END;

CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body_md)
  VALUES ('delete', old.rowid, old.title, old.body_md);
END;

CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body_md)
  VALUES ('delete', old.rowid, old.title, old.body_md);
  INSERT INTO notes_fts(rowid, title, body_md) VALUES (new.rowid, new.title, new.body_md);
END;
