import type { Movement } from "../shared/contracts.ts";
import { drain } from "./backup-cooperation.ts";
import { returnRecord, sale } from "./correction-records.ts";
import type { Db } from "./db/driver.ts";
import { checkCancelled, DomainFault } from "./domain.ts";
export function validateInventory(db: Db, signal: AbortSignal): void {
  drain(inventorySteps(db, signal));
}
export function* inventorySteps(db: Db, signal: AbortSignal) {
  const rows = db.all<Movement>("SELECT * FROM movements"),
    sums = new Map<string, { qty: bigint; value: bigint }>(),
    groups = new Map<string, Movement[]>();
  for (const m of rows) {
    checkCancelled(signal);
    yield;
    if (
      !Number.isSafeInteger(m.qty) ||
      Math.abs(m.qty) > 1e9 ||
      !Number.isSafeInteger(m.value) ||
      Math.abs(m.value) > 9e12 ||
      !m.qty ||
      (Math.sign(m.qty) !== Math.sign(m.value) && m.value !== 0)
    )
      throw new DomainFault("E_BACKUP_REFS");
    const sum = sums.get(m.productId) ?? { qty: 0n, value: 0n };
    sum.qty += BigInt(m.qty);
    sum.value += BigInt(m.value);
    sums.set(m.productId, sum);
    const group = groups.get(m.referenceId) ?? [];
    group.push(m);
    groups.set(m.referenceId, group);
  }
  for (const p of db.all<{
    id: string;
    stock: number;
    value: number;
    lastValue: number;
    lastQty: number;
  }>("SELECT * FROM products")) {
    yield;
    if (
      p.stock > 0 &&
      BigInt(p.lastValue) * BigInt(p.stock) !== BigInt(p.value) * BigInt(p.lastQty)
    )
      throw new DomainFault("E_BACKUP_COST");
    const base = db.get<{ stock: number; value: number }>(
        "SELECT * FROM inventory_bases WHERE productId=?",
        p.id,
      ) ?? { stock: 0, value: 0 },
      sum = sums.get(p.id) ?? { qty: 0n, value: 0n };
    if (
      !Number.isSafeInteger(base.stock) ||
      base.stock > 1e9 ||
      !Number.isSafeInteger(base.value) ||
      base.value > 9e12 ||
      (!base.stock && base.value) ||
      BigInt(base.stock) + sum.qty !== BigInt(p.stock) ||
      BigInt(base.value) + sum.value !== BigInt(p.value)
    )
      throw new DomainFault("E_BACKUP_REFS");
  }
  for (const [id, moves] of groups) {
    yield;
    const kind = moves[0]?.kind;
    if (moves.some((m) => m.kind !== kind)) throw new DomainFault("E_BACKUP_REFS");
    if (kind === "purchase") {
      const p = db.get<{ productId: string; qty: number; cost: number }>(
          "SELECT * FROM purchases WHERE id=?",
          id,
        ),
        m = moves[0];
      if (
        !p ||
        !m ||
        moves.length !== 1 ||
        m.productId !== p.productId ||
        m.qty !== p.qty ||
        m.value !== p.cost
      )
        throw new DomainFault("E_BACKUP_REFS");
    } else if (kind === "sale" || kind === "return") {
      const lines = kind === "sale" ? sale(db, id).lines : returnRecord(db, id).lines;
      if (kind === "return" && !returnRecord(db, id).restock)
        throw new DomainFault("E_BACKUP_REFS");
      const expected = new Map<string, { qty: bigint; value: bigint }>();
      for (const l of lines) {
        const x = expected.get(l.productId) ?? { qty: 0n, value: 0n };
        x.qty += BigInt(l.qty);
        x.value += BigInt(l.cost);
        expected.set(l.productId, x);
      }
      for (const m of moves) {
        const x = expected.get(m.productId),
          sign = kind === "sale" ? -1n : 1n;
        if (!x || BigInt(m.qty) !== sign * x.qty || BigInt(m.value) !== sign * x.value)
          throw new DomainFault("E_BACKUP_REFS");
        expected.delete(m.productId);
      }
      if (expected.size) throw new DomainFault("E_BACKUP_REFS");
    } else if (kind === "preparation") {
      const positive = moves.filter((m) => m.qty > 0),
        negative = moves.filter((m) => m.qty < 0);
      if (
        positive.length !== 1 ||
        negative.length < 1 ||
        negative.length > 2 ||
        moves.reduce((n, m) => n + BigInt(m.value), 0n) !== 0n
      )
        throw new DomainFault("E_BACKUP_REFS");
      if (
        !db.get(
          "SELECT 1 FROM products WHERE id=? AND kind='prepared'",
          positive[0]?.productId ?? "",
        )
      )
        throw new DomainFault("E_BACKUP_REFS");
    } else if (
      moves.length !== 1 ||
      !moves[0]?.reason.trim() ||
      (kind === "waste" && moves[0].qty >= 0)
    )
      throw new DomainFault("E_BACKUP_REFS");
  }
  for (const p of db.all<{ id: string }>("SELECT id FROM purchases"))
    if (!groups.has(p.id)) throw new DomainFault("E_BACKUP_REFS");
  for (const s of db.all<{ id: string; opening: number }>("SELECT id,opening FROM sales"))
    if (!s.opening && !groups.has(s.id)) throw new DomainFault("E_BACKUP_REFS");
  for (const r of db.all<{ id: string; restock: number }>("SELECT id,restock FROM returns"))
    if (r.restock && !groups.has(r.id)) throw new DomainFault("E_BACKUP_REFS");
}
