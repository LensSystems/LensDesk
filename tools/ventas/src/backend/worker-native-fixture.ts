import { randomUUID } from "node:crypto";
import { MAX_BACKUP_BYTES } from "../shared/backup-contracts.ts";
import { readDataset } from "./backup-dataset.ts";
import { encode } from "./backup-json.ts";
import type { Db } from "./db/driver.ts";
export function largeNative(db: Db) {
  const source = readDataset(db),
    id = randomUUID(),
    at = "2026-11-07T18:00:00.000Z";
  source.data.products.push({
    id,
    name: "Inventario",
    category: "Otros",
    kind: "simple",
    unit: "piece",
    price: 1,
    minStock: 0,
    stock: 0,
    value: 0,
    lastValue: 1,
    lastQty: 1,
    active: 1,
    icon: null,
  });
  source.data.inventory_bases.push({ productId: id, stock: 0, value: 0 });
  const movement = (n: number) => ({
    id: randomUUID(),
    productId: id,
    qty: n % 2 === 0 ? 1 : -1,
    value: n % 2 === 0 ? 1 : -1,
    kind: "adjustment",
    referenceId: randomUUID(),
    reason: "x",
    at,
    date: at.slice(0, 10),
  });
  const first = movement(0),
    second = movement(1),
    pair = encode(first).length + encode(second).length + 2,
    count =
      2 * Math.min(50000, Math.floor((MAX_BACKUP_BYTES - 4096 - encode(source).length + 1) / pair));
  source.data.movements = [
    first,
    second,
    ...Array.from({ length: count - 2 }, (_, n) => movement(n)),
  ];
  const bytes = encode(source);

  return { source, bytes, count };
}
