import { randomUUID } from "node:crypto";
import type { Action } from "../shared/contracts.ts";
import { saleBalance } from "./accounts-repo.ts";
import { paymentContext } from "./cash-repo.ts";
import { payment, returnedQuantities, sale } from "./correction-records.ts";
import type { Db } from "./db/driver.ts";
import { bounded, DomainFault, proportional, total } from "./domain.ts";
import { move } from "./inventory-repo.ts";
import { nextFolio } from "./trade-records.ts";

type Time = { at: string; date: string };
export function returnSale(
  db: Db,
  input: Extract<Action, { type: "returnSale" }>,
  time: Time,
): string {
  const original = sale(db, input.saleId);
  if (original.opening) throw new DomainFault("E_RETURN");
  const returned = returnedQuantities(db, original.id),
    seen = new Set<string>(),
    id = randomUUID();
  const lines = input.items.map((item) => {
    const line = original.lines.find((l) => l.id === item.lineId),
      prior = returned.get(item.lineId) ?? 0;
    if (!line || seen.has(item.lineId) || item.qty > line.qty - prior)
      throw new DomainFault("E_RETURN");
    seen.add(item.lineId);
    return {
      id: randomUUID(),
      returnId: id,
      lineId: line.id,
      productId: line.productId,
      qty: item.qty,
      amount: bounded(BigInt(line.price) * BigInt(item.qty)),
      cost:
        proportional(line.cost, prior + item.qty, line.qty) -
        proportional(line.cost, prior, line.qty),
    };
  });
  const amount = total(lines.map((l) => l.amount)),
    cost = total(lines.map((l) => l.cost)),
    balance = saleBalance(db, original.id);
  const refund = Math.max(0, amount - balance.pending);
  const context = refund
    ? paymentContext(db, input.refund.method, input.refund.bankId)
    : { cashId: null, bankSnapshot: null };
  db.run(
    "INSERT INTO returns VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    id,
    nextFolio(db, "return"),
    original.id,
    input.reason,
    Number(input.restock),
    amount,
    cost,
    refund,
    refund ? input.refund.method : null,
    refund ? input.refund.bankId : null,
    JSON.stringify(context.bankSnapshot),
    refund ? input.refund.reference : "",
    context.cashId,
    time.at,
    time.date,
  );
  for (const line of lines) {
    db.run(
      "INSERT INTO return_lines VALUES(?,?,?,?,?,?,?)",
      line.id,
      id,
      line.lineId,
      line.productId,
      line.qty,
      line.amount,
      line.cost,
    );
    if (input.restock)
      move(db, line.productId, line.qty, line.cost, "return", id, input.reason, time, true);
  }
  return id;
}
export function reversePayment(
  db: Db,
  input: Extract<Action, { type: "reversePayment" }>,
  time: Time,
): string {
  const original = payment(db, input.paymentId);
  if (original.reversalId || original.opening || !original.clientId)
    throw new DomainFault("E_REVERSE");
  if (
    db.get(
      "SELECT 1 FROM returns r JOIN payment_allocations a ON a.saleId=r.saleId WHERE a.paymentId=? AND r.refund>0 LIMIT 1",
      original.id,
    )
  )
    throw new DomainFault("E_REFUNDED_PAYMENT");
  const context =
    original.method === "cash"
      ? paymentContext(db, "cash", null)
      : { cashId: null, bankSnapshot: original.bankSnapshot };
  if (original.method === "transfer" && (!original.bankId || !original.bankSnapshot))
    throw new DomainFault("E_BANK");
  const id = randomUUID();
  db.run(
    "INSERT INTO payment_reversals VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    id,
    nextFolio(db, "reversal"),
    original.id,
    input.reason,
    original.amount,
    original.method,
    original.bankId,
    JSON.stringify(context.bankSnapshot),
    original.reference,
    context.cashId,
    time.at,
    time.date,
  );
  return id;
}
