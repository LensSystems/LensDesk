import { randomUUID } from "node:crypto";
import type { Action, Movement, Recipe, Settings } from "../shared/contracts.ts";
import type { Db } from "./db/driver.ts";
import { checked, DomainFault, operationalDate, proportional } from "./domain.ts";
import { product } from "./products-repo.ts";

type Clock = { at: string; date: string };
export function clock(at = new Date().toISOString()): Clock {
  return { at, date: operationalDate(at) };
}
export function move(
  db: Db,
  productId: string,
  qty: number,
  value: number,
  kind: Movement["kind"],
  referenceId: string,
  reason: string,
  time: Clock,
): void {
  const p = product(db, productId);
  const stock = checked(p.stock + qty, 1_000_000_000);
  const total = checked(p.value + value);
  if (!stock && total) throw new DomainFault("E_COST");
  db.run(
    "UPDATE products SET stock=?, value=?, lastValue=?, lastQty=? WHERE id=?",
    stock,
    total,
    stock ? total : p.lastValue,
    stock || p.lastQty,
    productId,
  );
  db.run(
    "INSERT INTO movements VALUES(?,?,?,?,?,?,?,?,?)",
    randomUUID(),
    productId,
    qty,
    value,
    kind,
    referenceId,
    reason,
    time.at,
    time.date,
  );
}
export function consume(
  db: Db,
  productId: string,
  qty: number,
  kind: Movement["kind"],
  referenceId: string,
  time: Clock,
): number {
  const p = product(db, productId);
  checked(qty, 1_000_000_000);
  if (!qty || qty > p.stock) throw new DomainFault("E_STOCK", p.id);
  const cost = qty === p.stock ? p.value : proportional(p.value, qty, p.stock);
  move(db, p.id, -qty, -cost, kind, referenceId, "", time);
  return cost;
}
export function prepare(db: Db, input: Extract<Action, { type: "prepare" }>, time: Clock): string {
  const p = product(db, input.productId);
  const recipe = db.get<Recipe>("SELECT * FROM recipes WHERE productId=?", p.id);
  if (p.kind !== "prepared" || !recipe) throw new DomainFault("E_RECIPE", p.id);
  const id = randomUUID();
  const grams = checked(recipe.grams * input.qty, 1_000_000_000);
  let cost = consume(db, recipe.materialId, grams, "preparation", id, time);
  if (recipe.packagingId)
    cost = checked(cost + consume(db, recipe.packagingId, input.qty, "preparation", id, time));
  move(db, p.id, input.qty, cost, "preparation", id, "", time);
  return id;
}
export function receive(db: Db, input: Extract<Action, { type: "receive" }>, time: Clock): string {
  if (product(db, input.productId).kind === "prepared")
    throw new DomainFault("E_PREPARED_PURCHASE");
  const settings = JSON.parse(
    db.get<{ data: string }>("SELECT data FROM settings WHERE id=1")?.data ?? "{}",
  ) as Settings;
  if (input.method === "transfer" && !settings.banks.some((b) => b.id === input.bankId))
    throw new DomainFault("E_BANK");
  if (input.method === "cash" && input.bankId) throw new DomainFault("E_BANK");
  const id = randomUUID();
  move(db, input.productId, input.qty, input.cost, "purchase", id, "", time);
  db.run(
    "INSERT INTO purchases VALUES(?,?,?,?,?,?,?,?)",
    id,
    input.productId,
    input.qty,
    input.cost,
    input.method,
    input.bankId,
    time.at,
    time.date,
  );
  return id;
}
export function adjust(db: Db, input: Extract<Action, { type: "adjust" }>, time: Clock): string {
  const p = product(db, input.productId);
  const qty = input.count - p.stock;
  if (!qty) throw new DomainFault("E_NO_CHANGE", p.id);
  if (input.waste && qty > 0) throw new DomainFault("E_STOCK", p.id);
  if (qty > 0 && p.lastValue <= 0) throw new DomainFault("E_COST", p.id);
  const amount =
    qty > 0 ? proportional(p.lastValue, qty, p.lastQty) : proportional(p.value, -qty, p.stock);
  const id = randomUUID();
  move(
    db,
    p.id,
    qty,
    qty > 0 ? amount : -amount,
    input.waste ? "waste" : "adjustment",
    id,
    input.reason,
    time,
  );
  return id;
}
