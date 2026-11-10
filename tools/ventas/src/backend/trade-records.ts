import type { Draft, Outflow, PaymentRecord, SaleRecord } from "../shared/trading-contracts.ts";
import type { Settings } from "../shared/values.ts";
import type { Db } from "./db/driver.ts";
import { DomainFault } from "./domain.ts";

export function settings(db: Db): Settings {
  return JSON.parse(db.get<{ data: string }>("SELECT data FROM settings WHERE id=1")?.data ?? "{}");
}
export function nextFolio(
  db: Db,
  name: "sale" | "payment" | "return" | "reversal",
  opening = false,
): number {
  for (;;) {
    db.run("UPDATE sequences SET value=value+1 WHERE name=?", name);
    const value = db.get<{ value: number }>(
      "SELECT value FROM sequences WHERE name=?",
      name,
    )?.value;
    if (!value || !Number.isSafeInteger(value)) throw new DomainFault("E_LIMIT");
    const labels =
      name === "sale"
        ? [`${opening ? "SI" : "V"}-${String(value).padStart(6, "0")}`]
        : name === "payment"
          ? [`AB-${value}`, `PAY-${value}`]
          : name === "return"
            ? [`DEV-${value}`, `RET-${value}`]
            : [];
    const entity = {
      sale: "sales",
      payment: "payments",
      return: "returns",
      reversal: "payment_reversals",
    }[name];
    if (
      !labels.length ||
      !db.get(
        `SELECT 1 FROM origins WHERE entity=? AND legacyFolio IN (${labels.map(() => "?").join(",")}) LIMIT 1`,
        entity,
        ...labels,
      )
    )
      return value;
  }
}
export function draft(db: Db): Draft {
  return {
    clientId:
      db.get<{ clientId: string | null }>("SELECT clientId FROM draft WHERE id=1")?.clientId ??
      null,
    lines: db.all("SELECT productId,qty FROM draft_lines ORDER BY rowid"),
  };
}
export type SaleRow = Omit<SaleRecord, "clientSnapshot" | "business" | "lines" | "opening"> & {
  clientSnapshot: string;
  business: string;
  lines: string;
  opening: number;
};
export function readSale(s: SaleRow): SaleRecord {
  return {
    ...s,
    clientSnapshot: JSON.parse(s.clientSnapshot),
    business: JSON.parse(s.business),
    lines: JSON.parse(s.lines),
    opening: Boolean(s.opening),
  };
}
export function sales(db: Db): SaleRecord[] {
  return db.all<SaleRow>("SELECT * FROM sales ORDER BY date,at,folio").map(readSale);
}

export function payments(db: Db): PaymentRecord[] {
  return db
    .all<Omit<PaymentRecord, "allocations" | "bankSnapshot"> & { bankSnapshot: string }>(
      "SELECT p.*,r.id AS reversalId FROM payments p LEFT JOIN payment_reversals r ON r.paymentId=p.id ORDER BY p.date,p.at,p.folio",
    )
    .map((p) => ({
      ...p,
      opening: Boolean(p.opening),
      bankSnapshot: JSON.parse(p.bankSnapshot),
      allocations: db.all(
        "SELECT saleId,amount FROM payment_allocations WHERE paymentId=? ORDER BY rowid",
        p.id,
      ),
    }));
}
export function outflows(db: Db, limit = 50): Outflow[] {
  return db
    .all<Omit<Outflow, "bankSnapshot"> & { bankSnapshot: string }>(
      "SELECT * FROM outflows ORDER BY at DESC,rowid DESC LIMIT ?",
      limit,
    )
    .map((p) => ({ ...p, bankSnapshot: JSON.parse(p.bankSnapshot) }));
}
