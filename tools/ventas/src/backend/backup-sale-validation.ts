import type { SaleRecord } from "../shared/trading-contracts.ts";
import { paymentSchema } from "../shared/trading-contracts.ts";
import { payment } from "./correction-records.ts";
import type { Db } from "./db/driver.ts";
import { bounded, DomainFault } from "./domain.ts";
export function validateSaleBalance(db: Db, original: SaleRecord): void {
  const balance = db.get<{ total: number; paid: number; pending: number }>(
    "SELECT total,paid,pending FROM sale_balances WHERE id=?",
    original.id,
  );
  if (
    !balance ||
    balance.total < 0 ||
    balance.paid < 0 ||
    balance.paid > balance.total ||
    balance.pending < 0 ||
    (!original.clientId && balance.pending !== 0)
  )
    throw new DomainFault("E_BACKUP_REFS");
  bounded(BigInt(balance.total));
  bounded(BigInt(balance.paid));
  bounded(BigInt(balance.pending));
  if (original.initialPaymentId) {
    const initial = paymentSchema.parse(payment(db, original.initialPaymentId));
    const applied = initial.allocations.find((a) => a.saleId === original.id);
    const bank = original.business.banks.find((b) => b.id === initial.bankId);
    if (
      initial.bankSnapshot &&
      bank &&
      ["id", "bank", "holder", "clabe"].some(
        (k) => initial.bankSnapshot?.[k as keyof typeof bank] !== bank[k as keyof typeof bank],
      )
    )
      throw new DomainFault("E_BACKUP_REFS");
    if (
      !applied ||
      initial.clientId !== original.clientId ||
      initial.opening ||
      initial.allocations.length !== 1 ||
      applied.amount !== initial.amount ||
      initial.amount > original.total
    )
      throw new DomainFault("E_BACKUP_REFS");
    if (
      !original.historyMissing?.includes("received") &&
      !original.historyMissing?.includes("change") &&
      (initial.method === "cash"
        ? original.received < initial.amount ||
          original.change !== original.received - initial.amount
        : original.received !== initial.amount || original.change !== 0)
    )
      throw new DomainFault("E_BACKUP_REFS");
  } else if (
    !original.opening &&
    !original.historyMissing?.includes("initialPayment") &&
    (original.received !== 0 || original.change !== 0)
  )
    throw new DomainFault("E_BACKUP_REFS");
  if (!original.clientId) {
    const allocations = db
      .all<{ amount: number }>(
        "SELECT a.amount FROM payment_allocations a JOIN payments p ON p.id=a.paymentId WHERE a.saleId=? AND p.opening=0",
        original.id,
      )
      .reduce((n, a) => n + BigInt(a.amount), 0n);
    if (original.opening || allocations !== BigInt(original.total))
      throw new DomainFault("E_BACKUP_REFS");
  }
  const unknown = new Set(original.historyMissing ?? []);
  if (
    (unknown.has("received") && original.received !== 0) ||
    (unknown.has("change") && original.change !== 0) ||
    (!unknown.has("received") && !unknown.has("change") && original.change > original.received) ||
    (original.opening &&
      (original.initialPaymentId !== null || original.received !== 0 || original.change !== 0))
  )
    throw new DomainFault("E_BACKUP_REFS");
}
