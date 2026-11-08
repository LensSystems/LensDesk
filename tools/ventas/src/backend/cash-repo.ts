import { randomUUID } from "node:crypto";
import type { BankSnapshot, Cash, Closing, PaymentInput } from "../shared/trading-contracts.ts";
import type { Db } from "./db/driver.ts";
import { DomainFault, total } from "./domain.ts";
import { settings } from "./trade-records.ts";

type Time = { at: string; date: string };
type Session = { id: string; initial: number; at: string; date: string };
export function cash(db: Db): Cash | null {
  const current = db.get<Session>(
    "SELECT id,initial,at,date FROM cash_sessions WHERE closing IS NULL",
  );
  if (!current) return null;
  const amounts = (table: string, extra = "") =>
    db
      .all<{ amount: number }>(
        `SELECT ${table === "purchases" ? "cost" : table === "returns" ? "refund" : "amount"} AS amount FROM ${table} WHERE cashId=? AND method='cash' ${extra}`,
        current.id,
      )
      .map((x) => x.amount);
  const ins = total(amounts("payments", "AND opening=0")),
    purchases = total(amounts("purchases"));
  const expenses = total(amounts("outflows", "AND kind='expense'")),
    withdrawals = total(amounts("outflows", "AND kind='withdrawal'"));
  const refunds = total(amounts("returns")),
    reversals = total(amounts("payment_reversals"));
  const outs = total([purchases, expenses, withdrawals, refunds, reversals]);
  return {
    ...current,
    ins,
    purchases,
    expenses,
    withdrawals,
    outs,
    refunds,
    reversals,
    expected: total([current.initial, ins, -outs], true),
  };
}
export function paymentContext(
  db: Db,
  method: PaymentInput["method"],
  bankId: string | null,
): { cashId: string | null; bankSnapshot: BankSnapshot | null } {
  if (method === "cash") {
    if (bankId) throw new DomainFault("E_BANK");
    const session = db.get<{ id: string }>("SELECT id FROM cash_sessions WHERE closing IS NULL");
    if (!session) throw new DomainFault("E_CASH_CLOSED");
    return { cashId: session.id, bankSnapshot: null };
  }
  const bank = settings(db).banks.find((b) => b.id === bankId);
  if (!bank) throw new DomainFault("E_BANK");
  return { cashId: null, bankSnapshot: bank };
}
export function validateReceived(input: PaymentInput): void {
  if (input.method === "cash" ? input.received < input.amount : input.received !== input.amount)
    throw new DomainFault("E_PAYMENT");
}
export function openCash(db: Db, initial: number, time: Time): string {
  if (cash(db)) throw new DomainFault("E_CASH_OPEN");
  const id = randomUUID();
  db.run("INSERT INTO cash_sessions VALUES(?,?,?,?,NULL)", id, initial, time.at, time.date);
  return id;
}
export function closeCash(db: Db, counted: number, reason: string, time: Time): string {
  const current = cash(db);
  if (!current) throw new DomainFault("E_CASH_CLOSED");
  const difference = total([counted, -current.expected], true);
  if (difference && !reason) throw new DomainFault("E_CASH_DIFFERENCE");
  const closing: Closing = {
    ...current,
    counted,
    difference,
    reason,
    closedAt: time.at,
    closedDate: time.date,
  };
  db.run("UPDATE cash_sessions SET closing=? WHERE id=?", JSON.stringify(closing), current.id);
  return current.id;
}
export function closings(db: Db): Closing[] {
  return db
    .all<{ closing: string }>(
      "SELECT closing FROM cash_sessions WHERE closing IS NOT NULL ORDER BY at DESC,rowid DESC LIMIT 20",
    )
    .map((c) => ({ refunds: 0, reversals: 0, ...JSON.parse(c.closing) }));
}
