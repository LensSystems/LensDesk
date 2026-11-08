import type { Account, PaymentRecord, SaleRecord } from "../shared/trading-contracts.ts";
import type { Db } from "./db/driver.ts";
import { bounded, total } from "./domain.ts";

type Purchase = Account["purchases"][number];
function finishAccount(clientId: string, today: string, purchases: Purchase[]): Account {
  const pending = purchases.filter((s) => s.pending > 0);
  return {
    clientId,
    purchases,
    balance: total(pending.map((s) => s.pending)),
    overdue: total(pending.filter((s) => s.due < today).map((s) => s.pending)),
    nextDue: pending.map((s) => s.due).sort()[0] ?? null,
    totalPaid: total(purchases.map((s) => s.paid)),
  };
}
function purchase(saleId: string, amount: number, due: string, paid: bigint): Purchase {
  const value = bounded(paid);
  if (value > amount) throw new Error("Payment allocations exceed sale total");
  return { saleId, total: amount, due, paid: value, pending: amount - value };
}
export function accountsFrom(
  clientIds: string[],
  today: string,
  sales: SaleRecord[],
  payments: PaymentRecord[],
): Account[] {
  const paid = new Map<string, bigint>(),
    byClient = new Map<string, Purchase[]>();
  for (const payment of payments)
    for (const allocation of payment.allocations)
      paid.set(allocation.saleId, (paid.get(allocation.saleId) ?? 0n) + BigInt(allocation.amount));
  for (const sale of sales) {
    if (!sale.clientId) continue;
    const list = byClient.get(sale.clientId) ?? [];
    list.push(purchase(sale.id, sale.total, sale.due, paid.get(sale.id) ?? 0n));
    byClient.set(sale.clientId, list);
  }
  return clientIds.map((id) => finishAccount(id, today, byClient.get(id) ?? []));
}
export function account(db: Db, clientId: string, today: string): Account {
  const rows = db.all<{ id: string; total: number; due: string; paid: number }>(
    `SELECT s.id,s.total,s.due,
      COALESCE((SELECT SUM(a.amount) FROM payment_allocations a WHERE a.saleId=s.id),0) AS paid
     FROM sales s WHERE s.clientId=? ORDER BY s.date,s.at,s.folio`,
    clientId,
  );
  return finishAccount(
    clientId,
    today,
    rows.map((row) => purchase(row.id, row.total, row.due, BigInt(row.paid))),
  );
}
