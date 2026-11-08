ALTER TABLE sales ADD COLUMN initialPaymentId TEXT REFERENCES payments(id);
UPDATE sales SET initialPaymentId=(
  SELECT p.id FROM payments p JOIN payment_allocations a ON a.paymentId=p.id
  WHERE a.saleId=sales.id ORDER BY p.folio LIMIT 1
) WHERE received>0;
INSERT INTO sequences VALUES ('return',0),('reversal',0);
CREATE TABLE returns (
 id TEXT PRIMARY KEY, folio INTEGER NOT NULL UNIQUE CHECK(folio>0), saleId TEXT NOT NULL REFERENCES sales(id),
 reason TEXT NOT NULL, restock INTEGER NOT NULL CHECK(restock IN (0,1)), amount INTEGER NOT NULL CHECK(amount>=0),
 cost INTEGER NOT NULL CHECK(cost>=0), refund INTEGER NOT NULL CHECK(refund>=0 AND refund<=amount),
 method TEXT CHECK(method IN ('cash','transfer')), bankId TEXT, bankSnapshot TEXT NOT NULL, reference TEXT NOT NULL,
 cashId TEXT REFERENCES cash_sessions(id), at TEXT NOT NULL, date TEXT NOT NULL
);
CREATE TABLE return_lines (
 id TEXT PRIMARY KEY, returnId TEXT NOT NULL REFERENCES returns(id), lineId TEXT NOT NULL,
 productId TEXT NOT NULL REFERENCES products(id), qty INTEGER NOT NULL CHECK(qty>0),
 amount INTEGER NOT NULL CHECK(amount>=0), cost INTEGER NOT NULL CHECK(cost>=0), UNIQUE(returnId,lineId)
);
CREATE TABLE payment_reversals (
 id TEXT PRIMARY KEY, folio INTEGER NOT NULL UNIQUE CHECK(folio>0), paymentId TEXT NOT NULL UNIQUE REFERENCES payments(id),
 reason TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), method TEXT NOT NULL CHECK(method IN ('cash','transfer')),
 bankId TEXT, bankSnapshot TEXT NOT NULL, reference TEXT NOT NULL, cashId TEXT REFERENCES cash_sessions(id), at TEXT NOT NULL, date TEXT NOT NULL
);
CREATE INDEX returns_sale ON returns(saleId,date,at,folio);
CREATE INDEX return_lines_line ON return_lines(lineId);
CREATE INDEX returns_cash ON returns(cashId,method);
CREATE INDEX reversals_cash ON payment_reversals(cashId,method);
CREATE INDEX sales_period ON sales(date,at,folio);
CREATE INDEX payments_period ON payments(date,at,folio);
CREATE INDEX returns_period ON returns(date,at,folio);
CREATE INDEX reversals_period ON payment_reversals(date,at,folio);
CREATE INDEX outflows_period ON outflows(date,at,id);
CREATE INDEX purchases_period ON purchases(date,at,id);
CREATE TABLE movements_v3 (
 id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES products(id), qty INTEGER NOT NULL,
 value INTEGER NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('purchase','adjustment','waste','preparation','sale','return')),
 referenceId TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL, date TEXT NOT NULL
);
INSERT INTO movements_v3 SELECT * FROM movements;
DROP TABLE movements;
ALTER TABLE movements_v3 RENAME TO movements;
CREATE INDEX movements_product ON movements(productId,at);
CREATE INDEX movements_period ON movements(date,at,id);
ALTER TABLE payments ADD COLUMN opening INTEGER NOT NULL DEFAULT 0 CHECK(opening IN (0,1));
CREATE VIEW sale_balances AS
SELECT id,clientId,originalTotal,originalTotal-returned AS total,allocated-refunded AS paid,
 originalTotal-returned-allocated+refunded AS pending,due,date,at,folio,returned,refunded
FROM (
 SELECT s.id,s.clientId,s.total AS originalTotal,s.due,s.date,s.at,s.folio,
  COALESCE((SELECT SUM(r.amount) FROM returns r WHERE r.saleId=s.id),0) AS returned,
  COALESCE((SELECT SUM(r.refund) FROM returns r WHERE r.saleId=s.id),0) AS refunded,
  COALESCE((SELECT SUM(a.amount) FROM payment_allocations a LEFT JOIN payment_reversals r ON r.paymentId=a.paymentId WHERE a.saleId=s.id AND r.id IS NULL),0) AS allocated
 FROM sales s
);
