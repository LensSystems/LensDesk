import { randomUUID } from "node:crypto";
import { addDays } from "../shared/calendar.ts";
import type { Action } from "../shared/contracts.ts";
import type { SaleRecord } from "../shared/trading-contracts.ts";
import { account } from "./accounts-repo.ts";
import { validateReceived } from "./cash-repo.ts";
import { client } from "./clients-repo.ts";
import type { Db } from "./db/driver.ts";
import { bounded, DomainFault, total } from "./domain.ts";
import { consume } from "./inventory-repo.ts";
import { recordPayment } from "./payments-repo.ts";
import { product } from "./products-repo.ts";
import { draft, nextFolio, settings } from "./trade-records.ts";

type Time = { at: string; date: string };
function insertSale(db: Db, s: SaleRecord): void {
  db.run(
    "INSERT INTO sales(id,folio,clientId,clientSnapshot,business,lines,total,term,due,exception,opening,note,received,change,at,date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    s.id,
    s.folio,
    s.clientId,
    JSON.stringify(s.clientSnapshot),
    JSON.stringify(s.business),
    JSON.stringify(s.lines),
    s.total,
    s.term,
    s.due,
    s.exception,
    Number(s.opening),
    s.note,
    s.received,
    s.change,
    s.at,
    s.date,
  );
}
export function sell(db: Db, input: Extract<Action, { type: "sell" }>, time: Time): string {
  const cart = draft(db),
    c = cart.clientId ? client(db, cart.clientId, true) : null;
  if (!cart.lines.length) throw new DomainFault("E_CART");
  const items = cart.lines.map((l) => {
    const p = product(db, l.productId);
    if (p.kind === "material") throw new DomainFault("E_KIND");
    return { ...l, p };
  });
  const amount = total(items.map((l) => bounded(BigInt(l.p.price) * BigInt(l.qty))));
  if (amount !== input.expectedTotal) throw new DomainFault("E_TOTAL");
  const paid = input.payment.amount;
  if (paid > amount || (!c && paid !== amount)) throw new DomainFault("E_PAYMENT");
  if (paid) validateReceived(input.payment);
  const debt = amount - paid;
  if (c && debt) {
    const a = account(db, c.id, time.date);
    if (
      (a.overdue > 0 || (c.limit !== null && total([a.balance, debt]) > c.limit)) &&
      !input.exception
    )
      throw new DomainFault("E_CREDIT");
    total([a.balance, debt]);
  }
  const id = randomUUID();
  const lines = items.map((l) => ({
    id: randomUUID(),
    productId: l.productId,
    name: l.p.name,
    qty: l.qty,
    price: l.p.price,
    cost: consume(db, l.productId, l.qty, "sale", id, time),
  }));
  const sale: SaleRecord = {
    initialPaymentId: null,
    id,
    folio: nextFolio(db, "sale"),
    clientId: cart.clientId,
    clientSnapshot: c,
    business: settings(db),
    lines,
    total: amount,
    term: c?.term ?? 0,
    due: c ? addDays(time.date, c.term) : time.date,
    exception: input.exception,
    opening: false,
    note: "",
    received: paid ? input.payment.received : 0,
    change: paid && input.payment.method === "cash" ? input.payment.received - paid : 0,
    ...time,
  };
  insertSale(db, sale);
  if (paid) {
    const paymentId = recordPayment(
      db,
      cart.clientId,
      input.payment,
      [{ saleId: id, amount: paid }],
      time,
    );
    db.run("UPDATE sales SET initialPaymentId=? WHERE id=?", paymentId, id);
  }
  db.run("DELETE FROM draft_lines");
  return id;
}
export function openingBalance(
  db: Db,
  input: Extract<Action, { type: "openingBalance" }>,
  time: Time,
): string {
  const c = client(db, input.clientId, true),
    id = randomUUID();
  total([account(db, c.id, time.date).balance, input.amount]);
  insertSale(db, {
    initialPaymentId: null,
    id,
    folio: nextFolio(db, "sale"),
    clientId: c.id,
    clientSnapshot: c,
    business: settings(db),
    lines: [],
    total: input.amount,
    term: 0,
    due: input.due,
    exception: "",
    opening: true,
    note: input.note,
    received: 0,
    change: 0,
    ...time,
  });
  return id;
}
