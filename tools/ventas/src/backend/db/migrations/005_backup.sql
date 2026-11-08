CREATE TABLE import_archives (id TEXT PRIMARY KEY, format TEXT NOT NULL, hash TEXT NOT NULL, payload TEXT NOT NULL);
CREATE TABLE origins (entity TEXT NOT NULL, id TEXT NOT NULL, sourceId TEXT NOT NULL, legacyFolio TEXT, missing TEXT NOT NULL, PRIMARY KEY(entity,id));
CREATE TABLE inventory_bases (productId TEXT PRIMARY KEY REFERENCES products(id), stock INTEGER NOT NULL CHECK(stock>=0), value INTEGER NOT NULL CHECK(value>=0));
INSERT INTO inventory_bases SELECT id,0,0 FROM products;
CREATE TABLE restore_history (id TEXT PRIMARY KEY, sourceHash TEXT NOT NULL, at TEXT NOT NULL, sourceRevision INTEGER NOT NULL);
CREATE TABLE restore_receipts (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL, backupId TEXT NOT NULL, backupHash TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX origins_folio ON origins(entity,legacyFolio);
