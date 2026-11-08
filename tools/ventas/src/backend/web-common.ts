import { createHash } from "node:crypto";
import { z } from "zod";
import type { Dataset } from "../shared/backup-contracts.ts";
import { settingsSchema } from "../shared/values.ts";
import { readDataset } from "./backup-dataset.ts";
import { memoryDatabase } from "./db/driver.ts";
import { DomainFault } from "./domain.ts";
export type W = Record<string, unknown>;
export function object(v: unknown): W {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new DomainFault("E_BACKUP_FORMAT");
  return v as W;
}
export function list(v: unknown): W[] {
  if (!Array.isArray(v) || v.length > 100000) throw new DomainFault("E_BACKUP_LIMIT");
  return v.map(object);
}
export function text(v: unknown, max = 120): string {
  if (typeof v !== "string" || v.length > max) throw new DomainFault("E_BACKUP_FORMAT");
  return v;
}
export function number(v: unknown, max = 9e12, min = 0): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max)
    throw new DomainFault("E_BACKUP_LIMIT");
  return v;
}
export function bool(v: unknown): boolean {
  if (typeof v !== "boolean") throw new DomainFault("E_BACKUP_FORMAT");
  return v;
}
export function sourceId(v: unknown): string {
  if (typeof v === "number")
    return String(number(v, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER));
  const s = text(v, 200);
  if (!s) throw new DomainFault("E_BACKUP_REFS");
  return s;
}
export function uuid(kind: string, id: unknown): string {
  const hex = createHash("sha256")
    .update(`lensdesk-ventas-web1:${kind}:${sourceId(id)}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function time(v: unknown): string {
  const s = text(v, 100);
  if (!Number.isFinite(Date.parse(s))) throw new DomainFault("E_BACKUP_FORMAT");
  return new Date(s).toISOString();
}
export function day(v: unknown): string {
  const r = z.iso.date().safeParse(v);
  if (!r.success) throw new DomainFault("E_BACKUP_FORMAT");
  return r.data;
}
export type WebContext = {
  data: Dataset;
  ledger: W;
  business: W;
  collections: Record<string, W[]>;
  maps: Map<string, Map<string, string>>;
  limitations: Set<string>;
  movementsByProduct: Map<string, W[]>;
  movementsByReference: Map<string, W[]>;
  ref: (kind: string, id: unknown) => string;
  origin: (kind: string, id: string, src: unknown, missing?: string[]) => void;
};
export function context(raw: unknown): WebContext {
  const root = object(raw);
  if (root.format !== "lensdesk-ventas-backup" || root.version !== 1)
    throw new DomainFault("E_BACKUP_FORMAT");
  const ledger = object(root.ledger),
    business = object(root.business);
  if (ledger.schema !== 1) throw new DomainFault("E_BACKUP_FORMAT");
  number(ledger.sequence, Number.MAX_SAFE_INTEGER);
  object(ledger.done);
  const db = memoryDatabase();
  let data: Dataset;
  try {
    data = readDataset(db).data;
  } finally {
    db.close();
  }
  const collections: Record<string, W[]> = {},
    maps = new Map<string, Map<string, string>>();
  const register = (kind: string, rows: W[]) => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const key = sourceId(r.id);
      if (map.has(key)) throw new DomainFault("E_BACKUP_REFS");
      map.set(key, uuid(kind, r.id));
    }
    maps.set(kind, map);
    collections[kind] = rows;
  };
  for (const k of [
    "products",
    "clients",
    "sales",
    "payments",
    "returns",
    "movements",
    "outflows",
    "preparations",
  ])
    register(k, list(ledger[k]));
  const sessions = [
    ...list(ledger.closings),
    ...(ledger.cash === null ? [] : [object(ledger.cash)]),
  ];
  register("cash", sessions);
  register("banks", list(business.accounts));
  if (maps.get("clients")?.has("mostrador")) throw new DomainFault("E_BACKUP_REFS");
  const movementsByProduct = new Map<string, W[]>(),
    movementsByReference = new Map<string, W[]>();
  for (const m of collections.movements ?? []) {
    for (const [map, key] of [
      [movementsByProduct, sourceId(m.product)],
      [movementsByReference, sourceId(m.ref)],
    ] as const) {
      const group = map.get(key) ?? [];
      group.push(m);
      map.set(key, group);
    }
  }
  const c: WebContext = {
    movementsByProduct,
    movementsByReference,
    data,
    ledger,
    business,
    collections,
    maps,
    limitations: new Set(),
    ref: (kind, id) => {
      const key = sourceId(id),
        v = maps.get(kind)?.get(key);
      if (!v) throw new DomainFault("E_BACKUP_REFS");
      return v;
    },
    origin: (entity, id, src, missing = []) => {
      data.origins.push({
        entity,
        id,
        sourceId: JSON.stringify(src),
        legacyFolio: ["sales", "payments", "returns"].includes(entity) ? sourceId(src) : null,
        missing: JSON.stringify(missing),
      });
      for (const x of missing) c.limitations.add(x);
    },
  };
  return c;
}
export const clientRef = (c: WebContext, v: unknown) =>
  v === "mostrador" ? null : c.ref("clients", v);
export const cashRef = (c: WebContext, v: unknown) =>
  v === undefined || v === null ? null : c.ref("cash", v);
export function bankRef(c: WebContext, reference: unknown, snapshot?: unknown): string {
  const key = sourceId(reference),
    map = c.maps.get("banks");
  if (!map) throw new DomainFault("E_BACKUP_REFS");
  if (snapshot) {
    const b = object(snapshot);
    if (b.id !== undefined && sourceId(b.id) !== key) throw new DomainFault("E_BACKUP_REFS");
    settingsSchema.shape.banks.element.parse({
      id: uuid("banks", key),
      bank: text(b.bank),
      holder: text(b.holder),
      clabe: text(b.clabe, 18),
    });
  } else c.limitations.add("bank");
  if (!map.has(key)) map.set(key, uuid("banks", key));
  return map.get(key) ?? uuid("banks", key);
}
export function bank(c: WebContext, v: unknown, reference: unknown): unknown {
  if (v === null || v === undefined) return null;
  const b = object(v);
  return {
    id: bankRef(c, b.id ?? reference, v),
    bank: text(b.bank),
    holder: text(b.holder),
    clabe: text(b.clabe, 18),
  };
}
export function business(c: WebContext, v: unknown) {
  const b = object(v);
  return settingsSchema.parse({
    name: text(b.storeName ?? b.name),
    address: text(b.address, 300),
    phone: text(b.phone, 40),
    thanks: text(b.footer ?? b.thanks, 300),
    banks: v === c.business ? c.collections.banks?.map((a) => bank(c, a, a.id)) : [],
  });
}
export const method = (v: unknown) =>
  v === "Efectivo"
    ? "cash"
    : v === "Transferencia"
      ? "transfer"
      : (() => {
          throw new DomainFault("E_BACKUP_FORMAT");
        })();
