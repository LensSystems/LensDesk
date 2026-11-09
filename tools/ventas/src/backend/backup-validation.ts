import { LensError } from "@lensdesk/sdk/errors";
import { z } from "zod";
import {
  type Dataset,
  datasetSchema,
  type NativeBackup,
  nativeBackupSchema,
  tables,
} from "../shared/backup-contracts.ts";
import { mutationResultSchema, snapshotResultSchema } from "../shared/contracts.ts";
import { returnSchema, reversalSchema } from "../shared/corrections-contracts.ts";
import { paymentSchema, saleSchema } from "../shared/trading-contracts.ts";
import { currentSettingsSchema, normalizeSettings } from "../shared/values.ts";
import { accountSummaries } from "./accounts-repo.ts";
import { cooperate, drain } from "./backup-cooperation.ts";
import { replaceDataset } from "./backup-dataset.ts";
import { inventorySteps } from "./backup-inventory.ts";
import { rowSteps } from "./backup-rows.ts";
import { validateSaleBalance } from "./backup-sale-validation.ts";
import { cash } from "./cash-repo.ts";
import { clients } from "./clients-repo.ts";
import { payment, returnRecord, reversal, sale } from "./correction-records.ts";
import { type Db, memoryDatabase } from "./db/driver.ts";
import { checkCancelled, DomainFault, proportional } from "./domain.ts";
import { normalizeLegacySettings } from "./legacy-settings.ts";
import { recoverProductIcons } from "./product-presentation.ts";
import { snapshot } from "./service.ts";
export function validateBackup(raw: unknown, signal: AbortSignal): NativeBackup {
  return drain(backupSteps(raw, signal));
}
export async function validateBackupAsync(
  raw: unknown,
  signal: AbortSignal,
): Promise<NativeBackup> {
  return await cooperate(backupSteps(raw, signal), signal);
}
function* backupSteps(
  raw: unknown,
  signal: AbortSignal,
): Generator<unknown, NativeBackup, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new DomainFault("E_BACKUP_FORMAT");
  const { data, ...header } = raw as Record<string, unknown>,
    parsed = nativeBackupSchema.omit({ data: true }).safeParse(header);
  if (
    !parsed.success ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    Object.keys(data).sort().join(",") !== [...tables].sort().join(",")
  )
    throw new DomainFault("E_BACKUP_FORMAT");
  const normalized = {} as Dataset;
  try {
    for (const table of tables) {
      const rows = (data as Record<string, unknown>)[table];
      if (!Array.isArray(rows) || rows.length > 100000) throw new DomainFault("E_BACKUP_FORMAT");
      normalized[table] = [];
      for (let n = 0; n < rows.length; n++) {
        if (n % 100 === 0) yield;
        normalized[table].push(datasetSchema.shape[table].element.parse(rows[n]));
      }
    }
  } catch (e) {
    if (e instanceof z.ZodError) throw new DomainFault("E_BACKUP_FORMAT");
    throw e;
  }
  const backup: NativeBackup = { ...parsed.data, data: normalized },
    db = memoryDatabase();
  try {
    if (normalized.settings.length !== 1) throw new DomainFault("E_BACKUP_REFS");
    const row = normalized.settings[0];
    if (!row) throw new DomainFault("E_BACKUP_REFS");
    const preferences = JSON.parse(String(row.data));
    if (parsed.data.modelVersion !== 5) currentSettingsSchema.parse(preferences);
    row.data = JSON.stringify(
      parsed.data.modelVersion === 5
        ? normalizeLegacySettings(preferences)
        : normalizeSettings(preferences),
    );
    if (parsed.data.modelVersion !== 7) yield* recoverProductIcons(normalized);
    backup.modelVersion = 7;
    yield* stageSteps(db, normalized);
    yield* rowSteps(db, normalized, signal);
    yield* financialSteps(db, signal, false);
    yield* inventorySteps(db, signal);
    return backup;
  } catch (e) {
    if (e instanceof DomainFault || e instanceof LensError) throw e;
    if (
      e instanceof SyntaxError ||
      e instanceof RangeError ||
      e instanceof z.ZodError ||
      (e instanceof Error && "code" in e && e.code === "ERR_SQLITE_ERROR")
    )
      throw new DomainFault("E_BACKUP_REFS");
    throw e;
  } finally {
    db.close();
  }
}
function* stageSteps(db: Db, data: Dataset) {
  // This isolated staging database has no observers. Each short transaction finishes before yielding.
  db.transaction(() =>
    replaceDataset(db, datasetSchema.parse(Object.fromEntries(tables.map((t) => [t, []])))),
  );
  for (const table of tables) {
    const columns = db.all<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name),
      expected = [...columns].sort().join(",");
    for (let n = 0; n < data[table].length; n += 100) {
      db.transaction(() => {
        for (const row of data[table].slice(n, n + 100)) {
          if (Object.keys(row).sort().join(",") !== expected)
            throw new DomainFault("E_BACKUP_FORMAT");
          db.run(
            `INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
            ...columns.map((c) =>
              table === "sales" && c === "initialPaymentId" ? null : (row[c] ?? null),
            ),
          );
        }
      });
      yield;
    }
  }
  db.transaction(() => {
    for (const s of data.sales)
      if (s.initialPaymentId !== null)
        db.run(
          "UPDATE sales SET initialPaymentId=? WHERE id=?",
          s.initialPaymentId ?? null,
          s.id ?? null,
        );
  });
  yield;
}
export function validateFinancial(db: Db, signal: AbortSignal, readSnapshot = true): void {
  drain(financialSteps(db, signal, readSnapshot));
}
export function* financialSteps(db: Db, signal: AbortSignal, readSnapshot = true) {
  if (readSnapshot) snapshotResultSchema.parse({ kind: "ok", value: snapshot(db) });
  for (const s of db.all<{ id: string }>("SELECT id FROM sales")) {
    checkCancelled(signal);
    yield;
    const original = saleSchema.parse(sale(db, s.id));
    validateSaleBalance(db, original);
    const ids = new Set<string>();
    let amount = 0n;
    for (const l of original.lines) {
      if (ids.has(l.id) || !db.get("SELECT 1 FROM products WHERE id=?", l.productId))
        throw new DomainFault("E_BACKUP_REFS");
      ids.add(l.id);
      amount += BigInt(l.qty) * BigInt(l.price);
    }
    if (
      original.opening
        ? original.lines.length !== 0
        : amount !== BigInt(original.total) || !original.lines.length
    )
      throw new DomainFault("E_BACKUP_REFS");
    if (original.clientSnapshot && original.clientSnapshot.id !== original.clientId)
      throw new DomainFault("E_BACKUP_REFS");
    if (
      original.initialPaymentId &&
      !db.get(
        "SELECT 1 FROM payment_allocations WHERE paymentId=? AND saleId=?",
        original.initialPaymentId,
        original.id,
      )
    )
      throw new DomainFault("E_BACKUP_REFS");
  }
  for (const p of db.all<{ id: string }>("SELECT id FROM payments")) {
    checkCancelled(signal);
    yield;
    const record = paymentSchema.parse(payment(db, p.id));
    let sum = 0n;
    for (const a of record.allocations) {
      sum += BigInt(a.amount);
      if (
        db.get<{ clientId: string | null }>("SELECT clientId FROM sales WHERE id=?", a.saleId)
          ?.clientId !== record.clientId
      )
        throw new DomainFault("E_BACKUP_REFS");
    }
    if (!record.allocations.length || sum !== BigInt(record.amount))
      throw new DomainFault("E_BACKUP_REFS");
  }
  const qty = new Map<string, bigint>(),
    cost = new Map<string, bigint>();
  for (const r of db.all<{ id: string }>("SELECT id FROM returns ORDER BY folio")) {
    yield;
    const record = returnSchema.parse(returnRecord(db, r.id)),
      original = sale(db, record.saleId);
    let amount = 0n,
      cogs = 0n;
    if (original.opening || !record.reason.trim() || !record.lines.length)
      throw new DomainFault("E_BACKUP_REFS");
    for (const l of record.lines) {
      const line = original.lines.find((x) => x.id === l.lineId),
        k = `${record.saleId}:${l.lineId}`;
      if (!line || line.productId !== l.productId) throw new DomainFault("E_BACKUP_REFS");
      qty.set(k, (qty.get(k) ?? 0n) + BigInt(l.qty));
      cost.set(k, (cost.get(k) ?? 0n) + BigInt(l.cost));
      if (
        (qty.get(k) ?? 0n) > BigInt(line.qty) ||
        (cost.get(k) ?? 0n) !== BigInt(proportional(line.cost, Number(qty.get(k)), line.qty)) ||
        BigInt(l.amount) !== BigInt(l.qty) * BigInt(line.price)
      )
        throw new DomainFault("E_BACKUP_REFS");
      amount += BigInt(l.amount);
      cogs += BigInt(l.cost);
    }
    if (
      amount !== BigInt(record.amount) ||
      cogs !== BigInt(record.cost) ||
      (record.refund > 0 && !record.method)
    )
      throw new DomainFault("E_BACKUP_REFS");
  }
  for (const r of db.all<{ id: string }>("SELECT id FROM payment_reversals")) {
    yield;
    const record = reversalSchema.parse(reversal(db, r.id)),
      p = payment(db, record.paymentId);
    if (
      p.opening ||
      !p.clientId ||
      p.amount !== record.amount ||
      p.method !== record.method ||
      p.bankId !== record.bankId ||
      !record.reason.trim()
    )
      throw new DomainFault("E_BACKUP_REFS");
  }
  for (const s of db.all<{ name: string; value: number }>("SELECT * FROM sequences")) {
    const table = {
      sale: "sales",
      payment: "payments",
      return: "returns",
      reversal: "payment_reversals",
    }[s.name];
    if (!table || s.value < (db.get<{ n: number }>(`SELECT MAX(folio) AS n FROM ${table}`)?.n ?? 0))
      throw new DomainFault("E_BACKUP_REFS");
  }
  if (db.all("SELECT * FROM sequences").length !== 4) throw new DomainFault("E_BACKUP_REFS");
  for (const op of db.all<{ key: string; fingerprint: string; result: string }>(
    "SELECT * FROM operations",
  )) {
    if (!/^[a-f0-9-]{36}$/i.test(op.key)) throw new DomainFault("E_BACKUP_REFS");
    JSON.parse(op.fingerprint);
    mutationResultSchema.parse(JSON.parse(op.result));
  }
  accountSummaries(
    db,
    clients(db).map((c) => c.id),
    new Date().toISOString().slice(0, 10),
  );
  cash(db);
  if (db.all("PRAGMA foreign_key_check").length) throw new DomainFault("E_BACKUP_REFS");
}
