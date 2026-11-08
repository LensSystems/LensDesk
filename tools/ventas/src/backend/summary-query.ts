import type { Summary } from "../shared/history-contracts.ts";
import type { SaleLine } from "../shared/trading-contracts.ts";
import { accountSummaries } from "./accounts-repo.ts";
import { clients } from "./clients-repo.ts";
import type { Db } from "./db/driver.ts";
import { bounded, checkCancelled, DomainFault } from "./domain.ts";
import { clock } from "./inventory-repo.ts";
export function summaryData(
  db: Db,
  range: { from: string; to: string },
  signal: AbortSignal,
): Summary {
  if (range.from > range.to) throw new DomainFault("E_PERIOD");
  const { from, to } = range;
  let revenue = 0n,
    cogs = 0n,
    expenses = 0n,
    loss = 0n,
    received = 0n,
    cash = 0n,
    transfer = 0n,
    purchases = 0n,
    withdrawals = 0n;
  const sold = new Map<string, { name: string; qty: bigint }>();
  const sales = db.all<{ total: number; lines: string }>(
    "SELECT total,lines FROM sales WHERE opening=0 AND date>=? AND date<=? ORDER BY date,at,folio",
    from,
    to,
  );
  for (const s of sales) {
    checkCancelled(signal);
    revenue += BigInt(s.total);
    for (const l of JSON.parse(s.lines) as SaleLine[]) {
      cogs += BigInt(l.cost);
      const prior = sold.get(l.productId);
      sold.set(l.productId, { name: l.name, qty: (prior?.qty ?? 0n) + BigInt(l.qty) });
    }
  }
  for (const r of db.all<{
    amount: number;
    cost: number;
    refund: number;
    restock: number;
    method: string | null;
  }>("SELECT amount,cost,refund,restock,method FROM returns WHERE date>=? AND date<=?", from, to)) {
    revenue -= BigInt(r.amount);
    cogs -= BigInt(r.cost);
    if (!r.restock) loss += BigInt(r.cost);
    received -= BigInt(r.refund);
    if (r.method === "cash") cash -= BigInt(r.refund);
    else if (r.method === "transfer") transfer -= BigInt(r.refund);
  }
  for (const l of db.all<{ productId: string; qty: number }>(
    "SELECT l.productId,l.qty FROM return_lines l JOIN returns r ON r.id=l.returnId WHERE r.date>=? AND r.date<=?",
    from,
    to,
  )) {
    const p = sold.get(l.productId);
    sold.set(l.productId, { name: p?.name ?? "", qty: (p?.qty ?? 0n) - BigInt(l.qty) });
  }
  for (const p of db.all<{ amount: number; method: string }>(
    "SELECT amount,method FROM payments WHERE opening=0 AND date>=? AND date<=?",
    from,
    to,
  )) {
    received += BigInt(p.amount);
    if (p.method === "cash") cash += BigInt(p.amount);
    else transfer += BigInt(p.amount);
  }
  for (const p of db.all<{ amount: number; method: string }>(
    "SELECT amount,method FROM payment_reversals WHERE date>=? AND date<=?",
    from,
    to,
  )) {
    received -= BigInt(p.amount);
    if (p.method === "cash") cash -= BigInt(p.amount);
    else transfer -= BigInt(p.amount);
  }
  for (const o of db.all<{ amount: number; kind: string }>(
    "SELECT amount,kind FROM outflows WHERE date>=? AND date<=?",
    from,
    to,
  )) {
    if (o.kind === "expense") expenses += BigInt(o.amount);
    else withdrawals += BigInt(o.amount);
  }
  for (const p of db.all<{ cost: number }>(
    "SELECT cost FROM purchases WHERE date>=? AND date<=?",
    from,
    to,
  ))
    purchases += BigInt(p.cost);
  for (const m of db.all<{ value: number }>(
    "SELECT value FROM movements WHERE kind IN ('waste','adjustment') AND value<0 AND date>=? AND date<=?",
    from,
    to,
  ))
    loss -= BigInt(m.value);
  const accounts = accountSummaries(
    db,
    clients(db).map((c) => c.id),
    clock().date,
  );
  checkCancelled(signal);
  const top = [...sold]
    .filter(([, p]) => p.qty > 0n)
    .sort((a, b) =>
      a[1].qty === b[1].qty ? a[0].localeCompare(b[0]) : a[1].qty > b[1].qty ? -1 : 1,
    )
    .slice(0, 6)
    .map(([productId, p]) => ({ productId, name: p.name, qty: bounded(p.qty) }));
  return {
    from,
    to,
    revenue: bounded(revenue, true),
    cogs: bounded(cogs, true),
    expenses: bounded(expenses),
    loss: bounded(loss),
    profit: bounded(revenue - cogs - expenses - loss, true),
    received: bounded(received, true),
    cash: bounded(cash, true),
    transfer: bounded(transfer, true),
    purchases: bounded(purchases),
    withdrawals: bounded(withdrawals),
    balance: bounded(accounts.reduce((n, a) => n + BigInt(a.balance), 0n)),
    overdue: bounded(accounts.reduce((n, a) => n + BigInt(a.overdue), 0n)),
    count: sales.length,
    top,
  };
}
