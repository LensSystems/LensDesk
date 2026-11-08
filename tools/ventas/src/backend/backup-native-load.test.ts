import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { MAX_BACKUP_BYTES, preparedSchema } from "../shared/backup-contracts.ts";
import { readDataset } from "./backup-dataset.ts";
import { encode } from "./backup-json.ts";
import { backupMethod } from "./backup-service.ts";
import { fileContext } from "./backup-test-context.ts";
import { openVentasDatabase } from "./db/driver.ts";

it("commits an admitted native file near 20 MiB without blocking cancellation delivery for a second", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ventas-native-load-")),
    db = openVentasDatabase(dir),
    f = fileContext(dir),
    controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined,
    due = 0,
    delivered = 0,
    criticalMs = 0,
    phase = "";
  try {
    const indexes = db.all(
      "SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name",
    );
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
        2 *
        Math.min(50000, Math.floor((MAX_BACKUP_BYTES - 4096 - encode(source).length + 1) / pair));
    source.data.movements = [
      first,
      second,
      ...Array.from({ length: count - 2 }, (_, n) => movement(n)),
    ];
    const bytes = encode(source);
    expect(bytes.length).toBeGreaterThan(MAX_BACKUP_BYTES * 0.999);
    expect(bytes.length).toBeLessThanOrEqual(MAX_BACKUP_BYTES);
    expect(source.data.import_archives).toHaveLength(0);
    f.input(bytes);
    const prepared = await backupMethod(
      db,
      "backupPrepare",
      { token: "input", name: "native-large.json" },
      f.ctx,
    );
    if (prepared.kind !== "ok") throw Error("Prepare failed");
    const p = preparedSchema.parse(prepared.value),
      request = { id: p.id, hash: p.hash, revision: p.revision, key: randomUUID() },
      transaction = db.transaction;
    db.transaction = (work) => {
      const start = performance.now();
      try {
        return transaction(work);
      } finally {
        if (phase === "committing") criticalMs = performance.now() - start;
      }
    };
    const ctx = {
      ...f.ctx,
      signal: controller.signal,
      progress: (_n: number, current?: string) => {
        phase = current ?? "";
        if (current === "committing") {
          due = performance.now() + 25;
          timer = setTimeout(() => {
            delivered = performance.now();
            controller.abort();
          }, 25);
        }
      },
    };
    const result = await backupMethod(db, "confirmRestore", request, ctx),
      end = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(result).toMatchObject({ kind: "ok" });
    expect(
      db.all("SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name"),
    ).toEqual(indexes);
    expect(criticalMs).toBeLessThan(1000);
    expect(delivered - due).toBeLessThan(1000);
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM movements")?.n).toBe(count);
    expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(1);
    expect(
      db.all("SELECT name FROM sqlite_temp_master WHERE name LIKE 'ventas_restore_%'"),
    ).toHaveLength(0);
    expect(await backupMethod(db, "confirmRestore", request, f.ctx)).toEqual(result);
    const measurement = {
      bytes: bytes.length,
      movements: count,
      criticalMs,
      deliveryLagMs: delivered - due,
      responseLagMs: end - due,
      receipts: 1,
    };
    console.log(JSON.stringify(measurement));
    if (process.env.VENTAS_CANCEL_EVIDENCE)
      writeFileSync(
        `${process.env.VENTAS_CANCEL_EVIDENCE}.native-committing.json`,
        JSON.stringify(measurement),
      );
  } finally {
    clearTimeout(timer);
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000); // Large fixture validation is cooperative; the atomic/delivery budget stays 1000 ms.
