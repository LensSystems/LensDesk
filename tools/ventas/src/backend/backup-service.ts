import { randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import type { BackendContext } from "@lensdesk/sdk/backend";
import { LensError } from "@lensdesk/sdk/errors";
import { z } from "zod";
import {
  MAX_BACKUP_BYTES,
  type NativeBackup,
  type PreparedBackup,
  type RestoreInput,
  restoreInputSchema,
} from "../shared/backup-contracts.ts";
import { mutationResultSchema } from "../shared/contracts.ts";
import { dropRestoreStage, installRestoreStage, stageRestore } from "./backup-commit.ts";
import { readDataset } from "./backup-dataset.ts";
import { copyPrevious, previousBytes } from "./backup-files.ts";
import { decode, encode, hash } from "./backup-json.ts";
import { validateBackupAsync } from "./backup-validation.ts";
import type { Db } from "./db/driver.ts";
import { checkCancelled, DomainFault } from "./domain.ts";
import { revision } from "./history-queries.ts";
import { adaptWebAsync } from "./web-backup.ts";

const tokenSchema = z.string().min(1).max(500),
  prepareSchema = z.strictObject({ token: tokenSchema, name: z.string().max(255) }),
  exportSchema = z.strictObject({ token: tokenSchema, previous: z.boolean().default(false) });
type Cached = { preview: PreparedBackup; token: string; backup: NativeBackup; expires: number };
const cache = new Map<string, Cached>();
const restoreLocks = new Map<string, Promise<void>>();
async function serialized<T>(dir: string, work: () => Promise<T>): Promise<T> {
  const previous = restoreLocks.get(dir) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  restoreLocks.set(dir, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (restoreLocks.get(dir) === tail) restoreLocks.delete(dir);
  }
}
function parse<T extends z.ZodType>(schema: T, params: unknown): z.infer<T> {
  const p = schema.safeParse(params);
  if (!p.success) throw new LensError("E_INVALID_PARAMS", "Invalid backup request");
  return p.data;
}
async function yieldWork(ctx: BackendContext, phase: string, fraction: number) {
  ctx.progress(fraction, phase);
  await setImmediate();
  checkCancelled(ctx.signal);
}
export async function backupMethod(db: Db, name: string, params: unknown, ctx: BackendContext) {
  try {
    if (name === "backupInfo") parse(z.strictObject({}).optional().nullable(), params);
    if (name === "backupInfo")
      return {
        kind: "ok",
        value: {
          previous: Boolean(db.get("SELECT 1 FROM restore_receipts LIMIT 1")),
          lastRestore:
            db.get<{ at: string }>("SELECT at FROM restore_receipts ORDER BY rowid DESC LIMIT 1")
              ?.at ?? null,
        },
      };
    if (name === "backupExport") {
      const p = parse(exportSchema, params);
      await yieldWork(ctx, "reading", 0.1);
      const bytes = p.previous
        ? await previousBytes(db, ctx.dataDir)
        : encode(await validateBackupAsync(readDataset(db), ctx.signal));
      await yieldWork(ctx, "writing", 0.8);
      await ctx.files.writeBytes(p.token, bytes);
      return { kind: "ok", value: { bytes: bytes.length, hash: hash(bytes) } };
    }
    if (name === "backupPrepare") {
      const p = parse(prepareSchema, params);
      cache.delete(ctx.dataDir);
      const bytes = await ctx.files.readBytes(p.token);
      await yieldWork(ctx, "validating", 0.2);
      const raw = decode(bytes);
      const web = Boolean(
          raw &&
            typeof raw === "object" &&
            "format" in raw &&
            raw.format === "lensdesk-ventas-backup",
        ),
        adapted = web ? await adaptWebAsync(raw, ctx.signal) : null;
      await yieldWork(ctx, "reconciling", 0.5);
      const backup = await validateBackupAsync(adapted?.backup ?? raw, ctx.signal);
      encode(backup);
      encode(readDataset(db));
      await yieldWork(ctx, "ready", 0.9);
      const preview: PreparedBackup = {
        id: randomUUID(),
        hash: hash(bytes),
        revision: revision(db),
        name: p.name,
        format: web ? "web1" : "native",
        createdAt: backup.createdAt,
        counts: Object.fromEntries(Object.entries(backup.data).map(([k, v]) => [k, v.length])),
        balance: "0",
        stockValue: backup.data.products
          .reduce((n, p) => n + BigInt(Number(p.value)), 0n)
          .toString(),
        limitations: [
          ...new Set([
            ...(adapted?.limitations ?? []),
            ...backup.data.origins.flatMap((o) => JSON.parse(String(o.missing)) as string[]),
            ...((
              ["purchases", "outflows", "payments", "returns", "payment_reversals"] as const
            ).some((table) =>
              backup.data[table].some(
                (r) =>
                  r.method === "transfer" &&
                  (r.bankSnapshot === null || JSON.parse(String(r.bankSnapshot)) === null),
              ),
            )
              ? ["bank"]
              : []),
          ]),
        ],
      };
      // Compute totals from the validated complete ledger, never from the compact UI snapshot.
      preview.balance = backupBalance(backup.data);
      for (const [dir, item] of cache) if (item.expires <= Date.now()) cache.delete(dir);
      while (cache.size >= 2) {
        const first = cache.keys().next().value;
        if (first) cache.delete(first);
        else break;
      }
      cache.set(ctx.dataDir, {
        preview,
        token: p.token,
        backup,
        expires: Date.now() + 600_000,
      });
      return { kind: "ok", value: preview };
    }
    if (name === "confirmRestore")
      return await serialized(ctx.dataDir, () =>
        confirm(db, parse(restoreInputSchema, params), ctx),
      );
    throw new LensError("E_INVALID_PARAMS", "Unknown backup request");
  } catch (error) {
    if (error instanceof z.ZodError)
      return { kind: "rejected", issue: { code: "E_BACKUP_FORMAT" as const } };
    if (error instanceof DomainFault) return { kind: "rejected", issue: error.issue };
    throw error;
  }
}
async function confirm(db: Db, p: RestoreInput, ctx: BackendContext) {
  const fingerprint = JSON.stringify({ id: p.id, hash: p.hash, revision: p.revision }),
    prior = db.get<{ fingerprint: string; result: string }>(
      "SELECT * FROM restore_receipts WHERE key=?",
      p.key,
    );
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw new DomainFault("E_DUPLICATE");
    return mutationResultSchema.parse(JSON.parse(prior.result));
  }
  const item = cache.get(ctx.dataDir);
  if (!item || item.expires <= Date.now() || item.preview.id !== p.id)
    throw new DomainFault("E_BACKUP_EXPIRED");
  if (item.preview.hash !== p.hash || item.preview.revision !== p.revision)
    throw new DomainFault("E_BACKUP_CHANGED");
  let bytes: Uint8Array;
  try {
    bytes = await ctx.files.readBytes(item.token);
  } catch (error) {
    // A completed read failure precedes all writes; cancellation/transport uncertainty is not proof.
    if (
      ctx.signal.aborted ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "E_CANCELLED")
    )
      throw error;
    cache.delete(ctx.dataDir);
    throw new DomainFault("E_BACKUP_SOURCE");
  }
  if (bytes.length > MAX_BACKUP_BYTES) throw new DomainFault("E_BACKUP_LIMIT");
  if (hash(bytes) !== p.hash) throw new DomainFault("E_BACKUP_CHANGED");
  await yieldWork(ctx, "copying", 0.2);
  const before = readDataset(db);
  if (before.revision !== p.revision) throw new DomainFault("E_REVISION");
  const saved = await copyPrevious(db, ctx.dataDir, encode(before));
  await yieldWork(ctx, "restoring", 0.7);
  const backup = await validateBackupAsync(item.backup, ctx.signal),
    next = Math.max(p.revision, backup.revision) + 1;
  if (!Number.isSafeInteger(next)) throw new DomainFault("E_LIMIT");
  let staged = false;
  try {
    await yieldWork(ctx, "staging", 0.8);
    await stageRestore(db, backup.data, ctx.signal);
    staged = true;
    await yieldWork(ctx, "committing", 0.95);
    const result = db.transaction(() => {
      revision(db, p.revision);
      installRestoreStage(db);
      checkCancelled(ctx.signal);
      const id = randomUUID(),
        at = new Date().toISOString(),
        response = { kind: "ok" as const, value: { id, revision: next } };
      db.run("UPDATE meta SET revision=? WHERE id=1", next);
      db.run("INSERT INTO restore_history VALUES(?,?,?,?)", id, p.hash, at, backup.revision);
      db.run(
        "INSERT INTO restore_receipts VALUES(?,?,?,?,?,?)",
        p.key,
        fingerprint,
        JSON.stringify(response),
        saved.id,
        saved.hash,
        at,
      );
      return response;
    });
    staged = false;
    cache.delete(ctx.dataDir);
    return result;
  } finally {
    if (staged) dropRestoreStage(db);
  }
}

function backupBalance(data: import("../shared/backup-contracts.ts").Dataset): string {
  const allocations = new Map<string, bigint>(),
    reversed = new Set(data.payment_reversals.map((r) => r.paymentId));
  for (const a of data.payment_allocations)
    if (!reversed.has(a.paymentId))
      allocations.set(
        String(a.saleId),
        (allocations.get(String(a.saleId)) ?? 0n) + BigInt(Number(a.amount)),
      );
  const returned = new Map<string, bigint>(),
    refunds = new Map<string, bigint>();
  for (const r of data.returns) {
    returned.set(
      String(r.saleId),
      (returned.get(String(r.saleId)) ?? 0n) + BigInt(Number(r.amount)),
    );
    refunds.set(String(r.saleId), (refunds.get(String(r.saleId)) ?? 0n) + BigInt(Number(r.refund)));
  }
  return data.sales
    .filter((s) => s.clientId !== null)
    .reduce(
      (n, s) =>
        n +
        BigInt(Number(s.total)) -
        (returned.get(String(s.id)) ?? 0n) -
        (allocations.get(String(s.id)) ?? 0n) +
        (refunds.get(String(s.id)) ?? 0n),
      0n,
    )
    .toString();
}
