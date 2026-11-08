CREATE TABLE sequences (name TEXT PRIMARY KEY, value INTEGER NOT NULL CHECK(value >= 0));
INSERT INTO sequences VALUES ('sale',0),('payment',0);
CREATE TABLE clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, term INTEGER NOT NULL CHECK(term BETWEEN 1 AND 30), creditLimit INTEGER CHECK(creditLimit >= 0), active INTEGER NOT NULL CHECK(active IN (0,1)));
CREATE TABLE draft (id INTEGER PRIMARY KEY CHECK(id=1), clientId TEXT REFERENCES clients(id));
INSERT INTO draft VALUES (1,NULL);
CREATE TABLE draft_lines (productId TEXT PRIMARY KEY REFERENCES products(id), qty INTEGER NOT NULL CHECK(qty>0));
CREATE TABLE cash_sessions (id TEXT PRIMARY KEY, initial INTEGER NOT NULL CHECK(initial>=0), at TEXT NOT NULL, date TEXT NOT NULL, closing TEXT);
CREATE UNIQUE INDEX one_open_cash ON cash_sessions((1)) WHERE closing IS NULL;
CREATE TABLE sales (id TEXT PRIMARY KEY, folio INTEGER NOT NULL UNIQUE CHECK(folio>0), clientId TEXT REFERENCES clients(id), clientSnapshot TEXT NOT NULL, business TEXT NOT NULL, lines TEXT NOT NULL, total INTEGER NOT NULL CHECK(total>=0), term INTEGER NOT NULL CHECK(term BETWEEN 0 AND 30), due TEXT NOT NULL, exception TEXT NOT NULL, opening INTEGER NOT NULL CHECK(opening IN (0,1)), note TEXT NOT NULL, received INTEGER NOT NULL CHECK(received>=0), change INTEGER NOT NULL CHECK(change>=0), at TEXT NOT NULL, date TEXT NOT NULL);
CREATE INDEX sales_client ON sales(clientId,date,at,folio);
CREATE TABLE payments (id TEXT PRIMARY KEY, folio INTEGER NOT NULL UNIQUE CHECK(folio>0), clientId TEXT REFERENCES clients(id), amount INTEGER NOT NULL CHECK(amount>0), method TEXT NOT NULL CHECK(method IN ('cash','transfer')), bankId TEXT, bankSnapshot TEXT NOT NULL, reference TEXT NOT NULL, cashId TEXT REFERENCES cash_sessions(id), at TEXT NOT NULL, date TEXT NOT NULL);
CREATE TABLE payment_allocations (paymentId TEXT NOT NULL REFERENCES payments(id), saleId TEXT NOT NULL REFERENCES sales(id), amount INTEGER NOT NULL CHECK(amount>0), PRIMARY KEY(paymentId,saleId));
CREATE INDEX allocations_sale ON payment_allocations(saleId);
CREATE TABLE outflows (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('expense','withdrawal')), concept TEXT NOT NULL, category TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), method TEXT NOT NULL CHECK(method IN ('cash','transfer')), bankId TEXT, bankSnapshot TEXT NOT NULL, cashId TEXT REFERENCES cash_sessions(id), at TEXT NOT NULL, date TEXT NOT NULL);
ALTER TABLE purchases ADD COLUMN cashId TEXT REFERENCES cash_sessions(id);
ALTER TABLE purchases ADD COLUMN bankSnapshot TEXT;
CREATE TABLE movements_v2 (
  id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES products(id), qty INTEGER NOT NULL,
  value INTEGER NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('purchase','adjustment','waste','preparation','sale')),
  referenceId TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL, date TEXT NOT NULL
);
INSERT INTO movements_v2 SELECT * FROM movements;
DROP TABLE movements;
ALTER TABLE movements_v2 RENAME TO movements;
CREATE INDEX movements_product ON movements(productId,at);
