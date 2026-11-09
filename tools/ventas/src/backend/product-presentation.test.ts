import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { NativeBackup } from "../shared/backup-contracts.ts";
import type { Action } from "../shared/contracts.ts";
import { cooperate } from "./backup-cooperation.ts";
import { readDataset, replaceDataset } from "./backup-dataset.ts";
import { validateBackup } from "./backup-validation.ts";
import { type Db, openVentasDatabase } from "./db/driver.ts";
import { recoverProductIcons } from "./product-presentation.ts";
import { execute, snapshot } from "./service.ts";
import { adaptWeb } from "./web-backup.ts";
import { webFixture } from "./web-backup-fixture.ts";

let dir: string, db: Db;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw Error("Missing fixture row");
  return value;
}
const signal = new AbortController().signal;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ventas-presentation-"));
  db = openVentasDatabase(dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const run = (action: Action, key = randomUUID()) => {
  const result = execute(db, { key, revision: snapshot(db).revision, action }, signal);
  if (result.kind !== "ok") throw Error(result.issue.code);
  return result;
};
function legacy(backup: NativeBackup, modelVersion: 5 | 6 = 6): NativeBackup {
  const old = structuredClone(backup);
  old.modelVersion = modelVersion;
  for (const product of old.data.products) delete product.icon;
  return old;
}
function imported() {
  const raw = webFixture();
  required(raw.ledger.products[0]).icon = "cookie";
  required(raw.ledger.products[1]).icon = "package";
  return { raw, backup: adaptWeb(raw).backup };
}
it("migrates six to seven without changing financial rows, old command identities or order", () => {
  const action = {
    type: "saveProduct",
    product: {
      name: "Zeta",
      category: "Pan",
      kind: "simple",
      unit: "piece",
      price: 100,
      minStock: 5,
    },
  } as const;
  const key = randomUUID(),
    result = run(action, key),
    first = result.value.id;
  const second = run({ ...action, product: { ...action.product, name: "Alfa" } }).value.id;
  const old = readDataset(db).data;
  db.exec("ALTER TABLE products DROP COLUMN icon; DELETE FROM schema_migrations WHERE version=7");
  db.close();
  db = openVentasDatabase(dir);
  const migrated = readDataset(db);
  expect(snapshot(db).products.map((p) => [p.id, p.icon])).toEqual([
    [first, null],
    [second, null],
  ]);
  for (const [table, rows] of Object.entries(old)) {
    if (table === "products")
      expect(migrated.data.products.map(({ icon: _, ...p }) => p)).toEqual(
        rows.map(({ icon: _, ...p }) => p),
      );
    else expect(migrated.data[table as keyof typeof old]).toEqual(rows);
  }
  expect(execute(db, { key, revision: 0, action }, signal)).toEqual(result);
  expect(
    db.get<{ fingerprint: string }>("SELECT fingerprint FROM operations WHERE key=?", key)
      ?.fingerprint,
  ).toBe(JSON.stringify(action));
  run({ type: "saveProduct", product: { ...action.product, id: first, name: "Actualizada" } });
  run({ type: "setActive", id: first, active: false });
  expect(snapshot(db).products.map((p) => p.id)).toEqual([first, second]);
  db.close();
  db = openVentasDatabase(dir);
  const backup = validateBackup(readDataset(db), signal);
  db.transaction(() => replaceDataset(db, backup.data));
  expect(snapshot(db).products.map((p) => p.id)).toEqual([first, second]);
  expect(execute(db, { key, revision: 0, action }, signal)).toEqual(result);
  expect(snapshot(db).products[0]?.icon).toBeNull();
  const material = run({
    type: "saveProduct",
    product: {
      name: "Material",
      category: "Insumos",
      kind: "material",
      unit: "g",
      price: 0,
      minStock: 5,
    },
  }).value.id;
  expect(snapshot(db).products.find((p) => p.id === material)?.icon).toBe("package");
});
it("preserves Web1 icons and recovers only consistent exact origins in legacy five/six backups", () => {
  const { raw, backup } = imported();
  expect(backup.data.products.map((p) => p.icon)).toEqual(["cookie", "package", "candy", "candy"]);
  for (const model of [5, 6] as const) {
    const old = legacy(backup, model),
      restored = validateBackup(old, signal);
    expect(restored.modelVersion).toBe(7);
    expect(restored.data.products.map((p) => p.icon)).toEqual(
      backup.data.products.map((p) => p.icon),
    );
    for (const [table, rows] of Object.entries(old.data))
      if (table !== "products" && table !== "settings")
        expect(restored.data[table as keyof typeof old.data]).toEqual(rows);
    db.transaction(() => replaceDataset(db, restored.data));
    expect(validateBackup(readDataset(db), signal).data).toEqual(readDataset(db).data);
    expect(snapshot(db).products.map((p) => p.name)).toEqual(
      raw.ledger.products.map((p) => p.name),
    );
  }
  db.exec("ALTER TABLE products DROP COLUMN icon; DELETE FROM schema_migrations WHERE version=7");
  db.close();
  db = openVentasDatabase(dir);
  expect(snapshot(db).products.map((p) => p.icon)).toEqual(["cookie", "package", "candy", "candy"]);
  expect(JSON.parse(String(readDataset(db).data.import_archives[0]?.payload))).toEqual(raw);
});
it("keeps conflicting, absent, duplicate-source and invalid icon evidence unknown", () => {
  const { backup, raw } = imported(),
    old = legacy(backup);
  const second = structuredClone(raw);
  required(second.ledger.products[0]).icon = "donut";
  const payload = JSON.stringify(second);
  old.data.import_archives.push({
    id: randomUUID(),
    format: "web1",
    hash: createHash("sha256").update(payload).digest("hex"),
    payload,
  });
  expect(validateBackup(old, signal).data.products[0]?.icon).toBeNull();
  old.data.import_archives.pop();
  const duplicate = structuredClone(raw);
  duplicate.ledger.products.push({ ...required(duplicate.ledger.products[0]) });
  required(old.data.import_archives[0]).payload = JSON.stringify(duplicate);
  expect(validateBackup(old, signal).data.products[0]?.icon).toBeNull();
  required(old.data.import_archives[0]).payload = JSON.stringify(raw);
  old.data.origins = old.data.origins.filter((o) => o.id !== old.data.products[0]?.id);
  expect(validateBackup(old, signal).data.products[0]?.icon).toBeNull();
  for (const icon of ["__proto__", "constructor", "toString", "remote-icon"]) {
    required(raw.ledger.products[0]).icon = icon;
    const current = adaptWeb(raw).backup;
    expect(current.data.products[0]?.icon).toBeNull();
    expect(validateBackup(legacy(current), signal).data.products[0]?.icon).toBeNull();
    expect(JSON.parse(String(current.data.import_archives[0]?.payload))).toEqual(raw);
  }
});
it("requires explicit valid metadata for model seven and rejects future eight", () => {
  const { backup } = imported();
  const absent = structuredClone(backup);
  delete required(absent.data.products[0]).icon;
  expect(() => validateBackup(absent, signal)).toThrow("E_BACKUP_FORMAT");
  for (const icon of ["__proto__", "constructor", "toString", "<svg>"]) {
    const invalid = structuredClone(backup);
    required(invalid.data.products[0]).icon = icon;
    expect(() => validateBackup(invalid, signal)).toThrow("E_BACKUP_REFS");
  }
  expect(() => validateBackup({ ...backup, modelVersion: 8 }, signal)).toThrow("E_BACKUP_FORMAT");
});
it("cooperates with cancellation while indexing legacy archive metadata", async () => {
  const { backup } = imported(),
    controller = new AbortController();
  const raw = webFixture();
  raw.ledger.products = Array.from({ length: 1000 }, (_, i) => ({
    ...required(raw.ledger.products[0]),
    id: `p${i}`,
  }));
  required(backup.data.import_archives[0]).payload = JSON.stringify(raw);
  const steps = recoverProductIcons(legacy(backup).data);
  let visited = 0;
  function* cancelling() {
    for (const step of steps) {
      if (++visited === 250) controller.abort();
      yield step;
    }
  }
  await expect(cooperate(cancelling(), controller.signal)).rejects.toThrow();
  expect(visited).toBe(250);
});
