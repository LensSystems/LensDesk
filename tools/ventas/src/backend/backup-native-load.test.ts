import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { MAX_BACKUP_BYTES, preparedSchema } from "../shared/backup-contracts.ts";
import { backupMethod } from "./backup-service.ts";
import { fileContext } from "./backup-test-context.ts";
import { openVentasDatabase } from "./db/driver.ts";
import { largeNative } from "./worker-native-fixture.ts";

it("commits an admitted native file near 20 MiB atomically and replays its receipt", async () => {
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
    const { source, bytes, count } = largeNative(db);
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
    expect(criticalMs).toBeGreaterThan(0);
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
}, 30000); // Large fixture validation is cooperative; runtime cancellation is checked separately.
