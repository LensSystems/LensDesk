CREATE TABLE meta (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL CHECK(revision >= 0));
INSERT INTO meta VALUES (1, 0);
CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL);
INSERT INTO settings VALUES (1, '{"name":"","address":"","phone":"","thanks":"","banks":[]}');
CREATE TABLE products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('simple','material','prepared')),
  unit TEXT NOT NULL CHECK(unit IN ('piece','g')),
  price INTEGER NOT NULL CHECK(price >= 0), minStock INTEGER NOT NULL CHECK(minStock >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), value INTEGER NOT NULL DEFAULT 0 CHECK(value >= 0),
  lastValue INTEGER NOT NULL DEFAULT 0 CHECK(lastValue >= 0), lastQty INTEGER NOT NULL DEFAULT 1 CHECK(lastQty > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  CHECK(kind = 'material' OR unit = 'piece'), CHECK(stock > 0 OR value = 0)
);
CREATE TABLE recipes (
  productId TEXT PRIMARY KEY REFERENCES products(id), materialId TEXT NOT NULL REFERENCES products(id),
  grams INTEGER NOT NULL CHECK(grams > 0), packagingId TEXT REFERENCES products(id),
  CHECK(productId != materialId), CHECK(packagingId IS NULL OR packagingId != materialId)
);
CREATE TABLE movements (
  id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES products(id), qty INTEGER NOT NULL,
  value INTEGER NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('purchase','adjustment','waste','preparation')),
  referenceId TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL, date TEXT NOT NULL
);
CREATE TABLE purchases (
  id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES products(id), qty INTEGER NOT NULL CHECK(qty > 0),
  cost INTEGER NOT NULL CHECK(cost >= 0), method TEXT NOT NULL CHECK(method IN ('cash','transfer')),
  bankId TEXT, at TEXT NOT NULL, date TEXT NOT NULL
);
CREATE TABLE operations (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL);
CREATE INDEX movements_product ON movements(productId, at);
