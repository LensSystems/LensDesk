ALTER TABLE notes ADD COLUMN archived_at TEXT;
CREATE INDEX notes_archive ON notes (deleted_at, archived_at, pinned DESC, updated_at DESC);
