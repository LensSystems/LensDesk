import type { Db } from "./db/driver.ts";
import { historical } from "./historical-metadata.ts";
export function paymentAllocationPage(db: Db, paymentId: string, offset = 0) {
  const total =
    db.get<{ total: number }>(
      "SELECT count(*) AS total FROM payment_allocations WHERE paymentId=?",
      paymentId,
    )?.total ?? 0;
  const rows = db
    .all<{ saleId: string; folio: number; opening: number; amount: number }>(
      "SELECT a.saleId,s.folio,s.opening,a.amount FROM payment_allocations a JOIN sales s ON s.id=a.saleId WHERE a.paymentId=? ORDER BY a.rowid LIMIT 50 OFFSET ?",
      paymentId,
      offset,
    )
    .map((a) => ({ ...a, opening: Boolean(a.opening), ...historical(db, "sales", a.saleId) }));
  return { total, nextOffset: offset + rows.length < total ? offset + rows.length : null, rows };
}
