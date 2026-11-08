import type { Draft, Outflow, PaymentRecord, SaleRecord } from "../shared/trading-contracts.ts";
import type { Settings } from "../shared/values.ts";
import type { Db } from "./db/driver.ts";

export function settings(db: Db): Settings {
  return JSON.parse(db.get<{ data: string }>("SELECT data FROM settings WHERE id=1")?.data ?? "{}");
}
export function nextFolio(db: Db, name: "sale" | "payment"): number {
  db.run("UPDATE sequences SET value=value+1 WHERE name=?", name);
  const value = db.get<{ value: number }>("SELECT value FROM sequences WHERE name=?", name)?.value;
  if (!value || !Number.isSafeInteger(value)) throw new Error("Invalid folio sequence");
  return value;
}
export function draft(db: Db): Draft {
  return {
    clientId:
      db.get<{ clientId: string | null }>("SELECT clientId FROM draft WHERE id=1")?.clientId ??
      null,
    lines: db.all("SELECT productId,qty FROM draft_lines ORDER BY rowid"),
  };
}
type SaleRow = Omit<SaleRecord, "clientSnapshot" | "business" | "lines" | "opening"> & {
  clientSnapshot: string;
  business: string;
  lines: string;
  opening: number;
};
export function sales(db: Db): SaleRecord[] {
  return db.all<SaleRow>("SELECT * FROM sales ORDER BY date,at,folio").map((s) => ({
    ...s,
    clientSnapshot: JSON.parse(s.clientSnapshot),
    business: JSON.parse(s.business),
    lines: JSON.parse(s.lines),
    opening: Boolean(s.opening),
  }));
}
export function payments(db: Db): PaymentRecord[] {
  return db
    .all<Omit<PaymentRecord, "allocations" | "bankSnapshot"> & { bankSnapshot: string }>(
      "SELECT * FROM payments ORDER BY date,at,folio",
    )
    .map((p) => ({
      ...p,
      bankSnapshot: JSON.parse(p.bankSnapshot),
      allocations: db.all(
        "SELECT saleId,amount FROM payment_allocations WHERE paymentId=? ORDER BY rowid",
        p.id,
      ),
    }));
}
export function outflows(db: Db): Outflow[] {
  return db
    .all<Omit<Outflow, "bankSnapshot"> & { bankSnapshot: string }>(
      "SELECT * FROM outflows ORDER BY at DESC,rowid DESC LIMIT 1000",
    )
    .map((p) => ({ ...p, bankSnapshot: JSON.parse(p.bankSnapshot) }));
}
