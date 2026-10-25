CREATE TABLE vault_attempts (
  purpose TEXT PRIMARY KEY CHECK (purpose IN ('password','recovery')),
  failures INTEGER NOT NULL DEFAULT 0,
  retry_at INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE notes ADD COLUMN orphaned INTEGER NOT NULL DEFAULT 0 CHECK (orphaned IN (0, 1));
