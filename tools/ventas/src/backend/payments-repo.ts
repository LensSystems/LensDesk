import { randomUUID } from "node:crypto";
import type { PaymentInput, PaymentRecord } from "../shared/trading-contracts.ts";
import { account } from "./accounts-repo.ts";
import { paymentContext, validateReceived } from "./cash-repo.ts";
import { client } from "./clients-repo.ts";
import type { Db } from "./db/driver.ts";
import { DomainFault, total } from "./domain.ts";
import { nextFolio } from "./trade-records.ts";

type Time = { at: string; date: string };
export function recordPayment(
  db: Db,
  clientId: string | null,
  input: PaymentInput,
  allocations: PaymentRecord["allocations"],
  time: Time,
): string {
  if (input.amount <= 0 || total(allocations.map((a) => a.amount)) !== input.amount)
    throw new DomainFault("E_PAYMENT");
  validateReceived(input);
  const context = paymentContext(db, input.method, input.bankId),
    id = randomUUID();
  db.run(
    "INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    id,
    nextFolio(db, "payment"),
    clientId,
    input.amount,
    input.method,
    input.bankId,
    JSON.stringify(context.bankSnapshot),
    input.reference,
    context.cashId,
    time.at,
    time.date,
  );
  for (const a of allocations)
    db.run("INSERT INTO payment_allocations VALUES(?,?,?)", id, a.saleId, a.amount);
  return id;
}
export function payAccount(db: Db, clientId: string, input: PaymentInput, time: Time): string {
  client(db, clientId);
  const a = account(db, clientId, time.date);
  if (!input.amount || input.amount > a.balance) throw new DomainFault("E_BALANCE");
  let remaining = input.amount;
  const allocations: PaymentRecord["allocations"] = [];
  for (const sale of a.purchases) {
    const amount = Math.min(remaining, sale.pending);
    if (amount) allocations.push({ saleId: sale.saleId, amount });
    remaining -= amount;
    if (!remaining) break;
  }
  return recordPayment(db, clientId, input, allocations, time);
}
export function outflow(
  db: Db,
  input: {
    kind: "expense" | "withdrawal";
    concept: string;
    category: string;
    payment: PaymentInput;
  },
  time: Time,
): string {
  if (!input.payment.amount) throw new DomainFault("E_PAYMENT");
  validateReceived(input.payment);
  const context = paymentContext(db, input.payment.method, input.payment.bankId),
    id = randomUUID();
  db.run(
    "INSERT INTO outflows(id,kind,concept,category,amount,method,bankId,bankSnapshot,cashId,at,date,reference) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    id,
    input.kind,
    input.concept,
    input.category,
    input.payment.amount,
    input.payment.method,
    input.payment.bankId,
    JSON.stringify(context.bankSnapshot),
    context.cashId,
    time.at,
    time.date,
    input.payment.reference,
  );
  return id;
}
