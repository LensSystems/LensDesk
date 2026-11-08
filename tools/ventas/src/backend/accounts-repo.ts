import type { Account, AccountSummary } from "../shared/trading-contracts.ts";
import type { Db } from "./db/driver.ts";
import { checked, total } from "./domain.ts";

export type BalanceRow = Account["purchases"][number] & {
  id: string;
  clientId: string | null;
  originalTotal: number;
  date: string;
  at: string;
  folio: number;
  returned: number;
  refunded: number;
};
export function balanceRows(db: Db, clientId?: string): BalanceRow[] {
  return db
    .all<Omit<BalanceRow, "saleId">>(
      `SELECT * FROM sale_balances ${clientId ? "WHERE clientId=?" : ""} ORDER BY date,at,folio`,
      ...(clientId ? [clientId] : []),
    )
    .map((row) => ({ ...row, saleId: row.id }));
}
function summary(clientId: string, today: string, rows: BalanceRow[]): AccountSummary {
  for (const row of rows) {
    checked(row.total);
    checked(row.paid);
    checked(row.pending);
    if (row.paid > row.total) throw new Error("Invalid sale balance");
  }
  const pending = rows.filter((s) => s.pending > 0);
  return {
    clientId,
    balance: total(pending.map((s) => s.pending)),
    overdue: total(pending.filter((s) => s.due < today).map((s) => s.pending)),
    nextDue: pending.map((s) => s.due).sort()[0] ?? null,
    totalPaid: total(rows.map((s) => s.paid)),
  };
}
export function accountSummaries(db: Db, clientIds: string[], today: string): AccountSummary[] {
  const grouped = new Map<string, BalanceRow[]>();
  for (const row of balanceRows(db)) {
    if (!row.clientId) continue;
    const list = grouped.get(row.clientId) ?? [];
    list.push(row);
    grouped.set(row.clientId, list);
  }
  return clientIds.map((id) => summary(id, today, grouped.get(id) ?? []));
}
export function account(db: Db, clientId: string, today: string): Account {
  const rows = balanceRows(db, clientId);
  return {
    ...summary(clientId, today, rows),
    purchases: rows.map((s) => ({
      saleId: s.id,
      total: s.total,
      paid: s.paid,
      pending: s.pending,
      due: s.due,
    })),
  };
}
export function saleBalance(db: Db, saleId: string): Account["purchases"][number] {
  const s = db.get<BalanceRow>("SELECT * FROM sale_balances WHERE id=?", saleId);
  if (!s) throw new Error("Missing sale balance");
  checked(s.total);
  checked(s.paid);
  checked(s.pending);
  return { saleId, total: s.total, paid: s.paid, pending: s.pending, due: s.due };
}
