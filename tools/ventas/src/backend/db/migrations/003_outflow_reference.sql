ALTER TABLE outflows ADD COLUMN reference TEXT NOT NULL DEFAULT '';
CREATE INDEX purchases_cash ON purchases(cashId,method);
CREATE INDEX payments_cash ON payments(cashId,method);
CREATE INDEX outflows_cash ON outflows(cashId,method,kind);
