import { randomUUID } from "node:crypto";
import type { ClientInput, ClientRecord, Draft } from "../shared/trading-contracts.ts";
import type { Db } from "./db/driver.ts";
import { DomainFault } from "./domain.ts";
import { product } from "./products-repo.ts";
import { draft } from "./trade-records.ts";

export function clients(db: Db): ClientRecord[] {
  return db
    .all<Omit<ClientRecord, "active"> & { active: number }>(
      "SELECT id,name,phone,term,creditLimit AS 'limit',active FROM clients ORDER BY name,id",
    )
    .map((c) => ({ ...c, active: Boolean(c.active) }));
}
export function client(db: Db, id: string, active = false): ClientRecord {
  const c = clients(db).find((c) => c.id === id);
  if (!c || (active && !c.active)) throw new DomainFault("E_CLIENT");
  return c;
}
export function saveClient(db: Db, input: ClientInput): string {
  const id = input.id ?? randomUUID();
  if (clients(db).some((c) => c.id !== id && c.name.toLowerCase() === input.name.toLowerCase()))
    throw new DomainFault("E_CLIENT_NAME");
  if (input.id) {
    client(db, id);
    db.run(
      "UPDATE clients SET name=?,phone=?,term=?,creditLimit=? WHERE id=?",
      input.name,
      input.phone,
      input.term,
      input.limit,
      id,
    );
  } else
    db.run(
      "INSERT INTO clients VALUES(?,?,?,?,?,1)",
      id,
      input.name,
      input.phone,
      input.term,
      input.limit,
    );
  return id;
}
export function saveDraft(db: Db, input: Draft): string {
  const previous = draft(db);
  if (input.clientId) client(db, input.clientId, input.clientId !== previous.clientId);
  const previousQty = new Map(previous.lines.map((line) => [line.productId, line.qty]));
  const ids = new Set<string>();
  for (const line of input.lines) {
    if (ids.has(line.productId)) throw new DomainFault("E_CART");
    ids.add(line.productId);
    const p = product(db, line.productId, false);
    const oldQty = previousQty.get(line.productId) ?? 0;
    const existing = oldQty > 0 && line.qty <= oldQty;
    if (p.kind === "material" || (!existing && (!p.active || line.qty > p.stock)))
      throw new DomainFault("E_STOCK", p.id);
  }
  db.run("UPDATE draft SET clientId=? WHERE id=1", input.clientId);
  db.run("DELETE FROM draft_lines");
  for (const line of input.lines)
    db.run("INSERT INTO draft_lines VALUES(?,?)", line.productId, line.qty);
  return randomUUID();
}
