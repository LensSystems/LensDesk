import type { ReturnRecord, ReversalRecord } from "../shared/corrections-contracts.ts";
import type { PaymentRecord, SaleRecord } from "../shared/trading-contracts.ts";
import type { Db } from "./db/driver.ts";
import { DomainFault } from "./domain.ts";
import { historical } from "./historical-metadata.ts";
import { readSale, type SaleRow } from "./trade-records.ts";
export function sale(db: Db, id: string): SaleRecord {
  const row = db.get<SaleRow>("SELECT * FROM sales WHERE id=?", id);
  if (!row) throw new DomainFault("E_NOT_FOUND");
  return { ...readSale(row), ...historical(db, "sales", id) } as SaleRecord;
}
export function payment(db: Db, id: string): PaymentRecord {
  const row = db.get<
    Omit<PaymentRecord, "bankSnapshot" | "allocations"> & { bankSnapshot: string }
  >(
    "SELECT p.*,r.id AS reversalId FROM payments p LEFT JOIN payment_reversals r ON r.paymentId=p.id WHERE p.id=?",
    id,
  );
  if (!row) throw new DomainFault("E_NOT_FOUND");
  return {
    ...row,
    ...historical(db, "payments", id),
    opening: Boolean(row.opening),
    bankSnapshot: JSON.parse(row.bankSnapshot),
    allocations: db.all(
      "SELECT saleId,amount FROM payment_allocations WHERE paymentId=? ORDER BY rowid",
      id,
    ),
  };
}
export function returnRecord(db: Db, id: string): ReturnRecord {
  const row = db.get<
    Omit<ReturnRecord, "bankSnapshot" | "lines" | "restock"> & {
      bankSnapshot: string;
      restock: number;
    }
  >("SELECT * FROM returns WHERE id=?", id);
  if (!row) throw new DomainFault("E_NOT_FOUND");
  return {
    ...row,
    ...historical(db, "returns", id),
    restock: Boolean(row.restock),
    bankSnapshot: JSON.parse(row.bankSnapshot),
    lines: db.all("SELECT * FROM return_lines WHERE returnId=? ORDER BY rowid", id),
  };
}
export function reversal(db: Db, id: string): ReversalRecord {
  const row = db.get<Omit<ReversalRecord, "bankSnapshot"> & { bankSnapshot: string }>(
    "SELECT * FROM payment_reversals WHERE id=?",
    id,
  );
  if (!row) throw new DomainFault("E_NOT_FOUND");
  return {
    ...row,
    ...historical(db, "payment_reversals", id),
    bankSnapshot: JSON.parse(row.bankSnapshot),
  };
}
export function returnedQuantities(db: Db, saleId: string): Map<string, number> {
  return new Map(
    db
      .all<{ lineId: string; qty: number }>(
        "SELECT l.lineId,SUM(l.qty) AS qty FROM return_lines l JOIN returns r ON r.id=l.returnId WHERE r.saleId=? GROUP BY l.lineId",
        saleId,
      )
      .map((l) => [l.lineId, l.qty]),
  );
}
