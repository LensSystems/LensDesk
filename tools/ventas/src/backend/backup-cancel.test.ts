import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { preparedSchema } from "../shared/backup-contracts.ts";
import { encode } from "./backup-json.ts";
import { backupMethod } from "./backup-service.ts";
import { fileContext } from "./backup-test-context.ts";
import { openVentasDatabase } from "./db/driver.ts";
import { largeWeb } from "./worker-web-fixture.ts";

for (const phaseToCancel of ["validating", "reconciling"])
  it(`cancels from another turn within one second during ${phaseToCancel}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "ventas-cancel-measure-")),
      db = openVentasDatabase(dir),
      f = fileContext(dir),
      controller = new AbortController();
    let due = 0,
      delivered = 0;
    try {
      const bytes = encode(largeWeb());
      f.input(bytes);
      const ctx = {
        ...f.ctx,
        signal: controller.signal,
        progress: (_n: number, phase?: string) => {
          if (phase === phaseToCancel) {
            due = performance.now() + 25;
            setTimeout(() => {
              delivered = performance.now();
              controller.abort();
            }, 25);
          }
        },
      };
      await expect(
        backupMethod(db, "backupPrepare", { token: "input", name: "large.json" }, ctx),
      ).rejects.toMatchObject({ code: "E_CANCELLED" });
      const response = performance.now();
      const measurement = {
        phase: phaseToCancel,
        bytes: bytes.length,
        products: 5000,
        movements: 5000,
        cancelDeliveryLagMs: Math.round(delivered - due),
        cancelResponseLagMs: Math.round(response - due),
      };
      if (process.env.VENTAS_CANCEL_EVIDENCE)
        writeFileSync(
          `${process.env.VENTAS_CANCEL_EVIDENCE}.${phaseToCancel}.json`,
          JSON.stringify(measurement),
        );
      console.log(JSON.stringify(measurement));
      expect(measurement.cancelResponseLagMs).toBeLessThan(1000);
      expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(0);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
for (const phaseToCancel of ["restoring", "staging"])
  it(`cancels real admitted 10000-row restoration during ${phaseToCancel} before committing`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "ventas-confirm-cancel-")),
      db = openVentasDatabase(dir),
      f = fileContext(dir),
      controller = new AbortController();
    let due = 0,
      delivered = 0,
      timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const indexes = db.all(
        "SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name",
      );
      const bytes = encode(largeWeb(10000));
      expect(bytes.length).toBe(5912913);
      f.input(bytes);
      const prepared = await backupMethod(
        db,
        "backupPrepare",
        { token: "input", name: "large.json" },
        f.ctx,
      );
      if (prepared.kind !== "ok") throw Error("Prepare failed");
      const p = preparedSchema.parse(prepared.value);
      const ctx = {
        ...f.ctx,
        signal: controller.signal,
        progress: (_n: number, phase?: string) => {
          if (phase === phaseToCancel && !due) {
            due = performance.now() + 25;
            timer = setTimeout(() => {
              delivered = performance.now();
              controller.abort();
            }, 25);
          }
        },
      };
      await expect(
        backupMethod(
          db,
          "confirmRestore",
          { id: p.id, hash: p.hash, revision: p.revision, key: crypto.randomUUID() },
          ctx,
        ),
      ).rejects.toMatchObject({ code: "E_CANCELLED" });
      const measurement = {
        phase: phaseToCancel,
        bytes: bytes.length,
        products: 10000,
        movements: 10000,
        deliveryLagMs: delivered - due,
        responseLagMs: performance.now() - due,
      };
      expect(
        db.all("SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name"),
      ).toEqual(indexes);
      expect(measurement.responseLagMs).toBeLessThan(1000);
      expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM products")?.n).toBe(0);
      expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(0);
      expect(
        db.all("SELECT name FROM sqlite_temp_master WHERE name LIKE 'ventas_restore_%'"),
      ).toHaveLength(0);
      expect(db.get<{ temp_store: number }>("PRAGMA temp_store")?.temp_store).toBe(2);
      if (process.env.VENTAS_CANCEL_EVIDENCE)
        writeFileSync(
          `${process.env.VENTAS_CANCEL_EVIDENCE}.${phaseToCancel}.json`,
          JSON.stringify(measurement),
        );
    } finally {
      clearTimeout(timer);
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20000); // Setup/validation may take seconds; the asserted cancellation budget remains 1000 ms.
it("commits the complete dataset and resolves post-commit uncertainty by receipt", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ventas-confirm-critical-")),
    db = openVentasDatabase(dir),
    f = fileContext(dir),
    controller = new AbortController();
  let phase = "",
    criticalMs = 0,
    due = 0,
    delivered = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const bytes = encode(largeWeb(10000));
    f.input(bytes);
    const prepared = await backupMethod(
      db,
      "backupPrepare",
      { token: "input", name: "large.json" },
      f.ctx,
    );
    if (prepared.kind !== "ok") throw Error("Prepare failed");
    const p = preparedSchema.parse(prepared.value),
      request = { id: p.id, hash: p.hash, revision: p.revision, key: crypto.randomUUID() },
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
    expect(criticalMs).toBeGreaterThan(0);
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM products")?.n).toBe(10000);
    expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(1);
    expect(
      db.all("SELECT name FROM sqlite_temp_master WHERE name LIKE 'ventas_restore_%'"),
    ).toHaveLength(0);
    expect(await backupMethod(db, "confirmRestore", request, f.ctx)).toEqual(result);
    expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(1);
    if (process.env.VENTAS_CANCEL_EVIDENCE)
      writeFileSync(
        `${process.env.VENTAS_CANCEL_EVIDENCE}.committing.json`,
        JSON.stringify({
          phase: "committing",
          bytes: bytes.length,
          products: 10000,
          movements: 10000,
          criticalMs,
          deliveryLagMs: delivered - due,
          responseLagMs: end - due,
          result,
          receipts: 1,
        }),
      );
  } finally {
    clearTimeout(timer);
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);
