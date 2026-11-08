import { bounded, DomainFault } from "./domain.ts";
import {
  bank,
  bankRef,
  cashRef,
  day,
  method,
  number,
  sourceId,
  text,
  time,
  type WebContext,
} from "./web-common.ts";
export function* mapCash(c: WebContext) {
  for (const o of c.collections.outflows ?? []) {
    yield;
    const id = c.ref("outflows", o.id),
      m = method(o.method),
      common = {
        id,
        method: m,
        bankId: m === "transfer" ? bankRef(c, o.bank, o.bankSnapshot) : null,
        bankSnapshot: JSON.stringify(bank(c, o.bankSnapshot, o.bank)),
        cashId: cashRef(c, o.cashId),
        at: time(o.at),
        date: day(o.date),
      };
    if (o.kind === "Compra de mercancía") {
      const matches = (c.movementsByReference.get(sourceId(o.id)) ?? []).filter(
          (x) => x.kind === "Compra",
        ),
        move = matches[0];
      if (matches.length !== 1 || !move || move.value !== o.amount)
        throw new DomainFault("E_BACKUP_REFS");
      c.data.purchases.push({
        ...common,
        productId: c.ref("products", move.product),
        qty: number(move.qty, 1e9, 1),
        cost: number(o.amount),
      });
    } else {
      if (o.kind !== "Gasto" && o.kind !== "Retiro del propietario")
        throw new DomainFault("E_BACKUP_FORMAT");
      c.data.outflows.push({
        ...common,
        kind: o.kind === "Gasto" ? "expense" : "withdrawal",
        concept: text(o.concept),
        category: text(o.category ?? "Otros"),
        amount: number(o.amount, 9e12, 1),
        reference: text(o.reference ?? "", 200),
      });
    }
    c.origin(o.kind === "Compra de mercancía" ? "purchases" : "outflows", id, o.id);
  }
  for (const session of c.collections.cash ?? []) {
    yield;
    const id = c.ref("cash", session.id),
      initial = number(session.initial),
      at = time(session.at),
      date = day(session.date);
    let closing: string | null = null;
    if (session.closedAt !== undefined) {
      const sum = (
        rows: typeof c.data.payments,
        key: string,
        filter = (_r: (typeof rows)[number]) => true,
      ) =>
        bounded(
          rows
            .filter((r) => r.cashId === id && r.method === "cash" && filter(r))
            .reduce((n, r) => n + BigInt(Number(r[key])), 0n),
        );
      const ins = sum(c.data.payments, "amount", (r) => r.opening === 0),
        purchases = sum(c.data.purchases, "cost"),
        expenses = sum(c.data.outflows, "amount", (r) => r.kind === "expense"),
        withdrawals = sum(c.data.outflows, "amount", (r) => r.kind === "withdrawal"),
        refunds = sum(c.data.returns, "refund"),
        reversals = sum(c.data.payment_reversals, "amount"),
        outs = bounded(
          BigInt(purchases) +
            BigInt(expenses) +
            BigInt(withdrawals) +
            BigInt(refunds) +
            BigInt(reversals),
        ),
        expected = bounded(BigInt(initial) + BigInt(ins) - BigInt(outs), true),
        counted = number(session.counted),
        difference = bounded(BigInt(counted) - BigInt(expected), true);
      if (
        ins !== session.ins ||
        outs !== session.outs ||
        expected !== session.expected ||
        difference !== session.difference
      )
        throw new DomainFault("E_BACKUP_CLOSING");
      closing = JSON.stringify({
        id,
        initial,
        at,
        date,
        ins,
        purchases,
        expenses,
        withdrawals,
        refunds,
        reversals,
        outs,
        expected,
        counted,
        difference,
        reason: text(session.reason, 500),
        closedAt: time(session.closedAt),
        closedDate: day(session.closedDate),
      });
    }
    c.data.cash_sessions.push({ id, initial, at, date, closing });
    c.origin("cash_sessions", id, session.id);
  }
}
