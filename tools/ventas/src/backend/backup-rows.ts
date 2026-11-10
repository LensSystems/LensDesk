import { z } from "zod";
import type { Dataset } from "../shared/backup-contracts.ts";
import { commandSchema, mutationResultSchema } from "../shared/contracts.ts";
import { closingSchema } from "../shared/trading-contracts.ts";
import { contractSteps } from "./backup-contract-validation.ts";
import { drain } from "./backup-cooperation.ts";
import type { Db } from "./db/driver.ts";
import { checkCancelled, DomainFault } from "./domain.ts";

const flags = z
  .array(
    z.enum([
      "business",
      "client",
      "clientDetails",
      "received",
      "change",
      "initialPayment",
      "bank",
      "correctionOrderUnknown",
    ]),
  )
  .max(20);
export function validateRows(db: Db, data: Dataset, signal: AbortSignal): void {
  drain(rowSteps(db, data, signal));
}
export function* rowSteps(db: Db, data: Dataset, signal: AbortSignal) {
  yield* contractSteps(data);
  for (const [table, rows] of Object.entries(data))
    for (const row of rows) {
      checkCancelled(signal);
      yield;
      for (const [key, v] of Object.entries(row)) {
        const textLimit: Record<string, number> = {
          name: 120,
          category: 120,
          phone: 40,
          concept: 120,
          reason: 500,
          note: 500,
          exception: 500,
          reference: 200,
        };
        if (
          typeof v === "string" &&
          textLimit[key] !== undefined &&
          v.length > Number(textLimit[key])
        )
          throw new DomainFault("E_BACKUP_LIMIT");
        if (
          ["stock", "minStock", "grams", "lastQty"].includes(key) &&
          typeof v === "number" &&
          (v < 0 || v > 1e9)
        )
          throw new DomainFault("E_BACKUP_LIMIT");
        if (
          [
            "price",
            "value",
            "lastValue",
            "initial",
            "amount",
            "cost",
            "received",
            "change",
            "refund",
            "creditLimit",
          ].includes(key) &&
          v !== null &&
          typeof v === "number" &&
          (Math.abs(v) > 9e12 || (table !== "movements" && v < 0))
        )
          throw new DomainFault("E_BACKUP_LIMIT");
        if (key === "qty" && typeof v === "number" && Math.abs(v) > 1e9)
          throw new DomainFault("E_BACKUP_LIMIT");
        if (
          (key === "at" && !z.iso.datetime().safeParse(v).success) ||
          (key === "date" && !z.iso.date().safeParse(v).success)
        )
          throw new DomainFault("E_BACKUP_FORMAT");
        if (
          ((key === "id" && !["settings", "draft"].includes(table)) ||
            (key.endsWith("Id") && key !== "sourceId")) &&
          v !== null &&
          !z.uuid().safeParse(v).success
        )
          throw new DomainFault("E_BACKUP_REFS");
      }
    }
  for (const entity of ["products", "clients"]) {
    const names = new Set<string>();
    for (const row of data[entity as "products"]) {
      const key = String(row.name).trim().toLowerCase();
      if (names.has(key)) throw new DomainFault("E_BACKUP_REFS");
      names.add(key);
    }
  }
  const productMap = new Map(data.products.map((p) => [p.id, p]));
  for (const r of data.recipes) {
    yield;
    const p = productMap.get(r.productId),
      m = productMap.get(r.materialId),
      pack = r.packagingId ? productMap.get(r.packagingId) : null;
    if (
      p?.kind !== "prepared" ||
      m?.kind !== "material" ||
      m.unit !== "g" ||
      (pack && (pack.kind !== "material" || pack.unit !== "piece"))
    )
      throw new DomainFault("E_BACKUP_REFS");
  }
  const entityIds = new Map(
    Object.entries(data).map(([entity, rows]) => [entity, new Set(rows.map((r) => r.id))]),
  );
  const preparations = new Set(
    data.movements.filter((m) => m.kind === "preparation").map((m) => m.referenceId),
  );
  for (const o of data.origins) {
    yield;
    const entity = String(o.entity);
    if (!(entity in data) && entity !== "preparations") throw new DomainFault("E_BACKUP_REFS");
    if (entity === "preparations" ? !preparations.has(o.id) : !entityIds.get(entity)?.has(o.id))
      throw new DomainFault("E_BACKUP_REFS");
    flags.parse(JSON.parse(String(o.missing)));
    if (o.legacyFolio !== null && (typeof o.legacyFolio !== "string" || o.legacyFolio.length > 200))
      throw new DomainFault("E_BACKUP_FORMAT");
    JSON.parse(String(o.sourceId));
  }
  for (const a of data.import_archives) {
    yield;
    if (a.format !== "web1" || !/^[a-f0-9]{64}$/.test(String(a.hash)))
      throw new DomainFault("E_BACKUP_FORMAT");
    JSON.parse(String(a.payload));
  }
  for (const op of data.operations) {
    commandSchema.parse({ key: op.key, revision: 0, action: JSON.parse(String(op.fingerprint)) });
    mutationResultSchema.parse(JSON.parse(String(op.result)));
  }
  const sum = (
    table: keyof Dataset,
    id: unknown,
    key: string,
    predicate = (r: Dataset[typeof table][number]) => r.method === "cash",
  ) =>
    data[table]
      .filter((r) => r.cashId === id && predicate(r))
      .reduce((n, r) => n + BigInt(Number(r[key])), 0n);
  for (const session of data.cash_sessions)
    if (session.closing !== null) {
      yield;
      const c = closingSchema.parse({
        refunds: 0,
        reversals: 0,
        ...JSON.parse(String(session.closing)),
      });
      const ins = sum(
          "payments",
          session.id,
          "amount",
          (r) => r.method === "cash" && r.opening === 0,
        ),
        purchases = sum("purchases", session.id, "cost"),
        expenses = sum(
          "outflows",
          session.id,
          "amount",
          (r) => r.method === "cash" && r.kind === "expense",
        ),
        withdrawals = sum(
          "outflows",
          session.id,
          "amount",
          (r) => r.method === "cash" && r.kind === "withdrawal",
        ),
        refunds = sum("returns", session.id, "refund"),
        reversals = sum("payment_reversals", session.id, "amount"),
        outs = purchases + expenses + withdrawals + refunds + reversals;
      if (
        c.id !== session.id ||
        c.initial !== session.initial ||
        c.at !== session.at ||
        c.date !== session.date ||
        BigInt(c.ins) !== ins ||
        BigInt(c.outs) !== outs ||
        BigInt(c.expected) !== BigInt(c.initial) + ins - outs ||
        BigInt(c.difference) !== BigInt(c.counted) - BigInt(c.expected) ||
        BigInt(c.purchases) !== purchases ||
        BigInt(c.expenses) !== expenses ||
        BigInt(c.withdrawals) !== withdrawals ||
        BigInt(c.refunds) !== refunds ||
        BigInt(c.reversals) !== reversals
      )
        throw new DomainFault("E_BACKUP_CLOSING");
    }
  if (db.all("PRAGMA foreign_key_check").length) throw new DomainFault("E_BACKUP_REFS");
}
