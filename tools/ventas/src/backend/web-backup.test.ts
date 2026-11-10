import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { nativeBackupSchema, preparedSchema } from "../shared/backup-contracts.ts";
import { readDataset } from "./backup-dataset.ts";
import { encode } from "./backup-json.ts";
import { backupMethod } from "./backup-service.ts";
import { fileContext } from "./backup-test-context.ts";
import { validateBackup } from "./backup-validation.ts";
import { sale } from "./correction-records.ts";
import { type Db, openVentasDatabase } from "./db/driver.ts";
import { query } from "./queries.ts";
import { execute, snapshot } from "./service.ts";
import { nextFolio } from "./trade-records.ts";
import { adaptWeb } from "./web-backup.ts";
import { webFixture } from "./web-backup-fixture.ts";

let dir: string, db: Db, f: ReturnType<typeof fileContext>;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ventas-web-backup-"));
  db = openVentasDatabase(dir);
  f = fileContext(dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
it("adapts web1 completely without executing commands, preserving aliases, opening, costs and provenance", async () => {
  const web = webFixture(),
    adapted = adaptWeb(web),
    backup = validateBackup(adapted.backup, f.ctx.signal);
  expect(backup.data.operations).toEqual([]);
  expect(backup.data.inventory_bases).toHaveLength(4);
  expect(backup.data.import_archives[0]?.payload).toBe(JSON.stringify(web));
  expect(backup.data.origins.some((o) => o.legacyFolio === "VENTA-arbitraria")).toBe(true);
  expect(backup.data.payment_reversals).toHaveLength(1);
  expect(backup.data.payments[0]?.opening).toBe(1);
  expect(backup.data.purchases).toHaveLength(1);
  expect(backup.data.outflows).toEqual([]);
  expect(backup.data.recipes).toHaveLength(1);
  expect(backup.data.draft_lines).toHaveLength(2);
  f.input(encode(web));
  const r = await backupMethod(db, "backupPrepare", { token: "input", name: "web.json" }, f.ctx);
  if (r.kind !== "ok") throw Error(JSON.stringify(r));
  const p = preparedSchema.parse(r.value);
  expect(p).toMatchObject({ format: "web1", balance: "800", stockValue: "10500" });
  expect(p.limitations).toContain("initialPayment");
  expect(
    await backupMethod(
      db,
      "confirmRestore",
      { id: p.id, hash: p.hash, revision: p.revision, key: crypto.randomUUID() },
      f.ctx,
    ),
  ).toMatchObject({ kind: "ok" });
  expect(snapshot(db).cash?.expected).toBe(900);
  expect(snapshot(db).accounts[0]?.balance).toBe(800);
  const original = sale(db, String(backup.data.sales[1]?.id));
  expect(original.legacyFolio).toBe("VENTA-arbitraria");
  expect(original.initialPaymentId).toBeNull();
  expect(original.historyMissing).toContain("initialPayment");
  expect(sale(db, String(backup.data.sales[0]?.id)).historyMissing).toContain("business");
  for (const [kind, term] of [
    ["sales", "VENTA-arbitraria"],
    ["payments", "p2"],
    ["returns", "DEV-textual"],
  ])
    expect(query(db, "history", { kind, query: term }, f.ctx.signal)).toMatchObject({
      kind: "ok",
      value: { total: 1 },
    });
  const exported = readDataset(db);
  expect(validateBackup(exported, f.ctx.signal).data).toEqual(exported.data);
  expect(nativeBackupSchema.parse(exported).data.import_archives).toEqual(
    backup.data.import_archives,
  );
});
it("rejects ambiguous IDs, Mostrador collisions, orphan references and non-conservable costs", () => {
  const ambiguous = webFixture();
  ambiguous.ledger.products.push({
    ...ambiguous.ledger.products[0],
    id: "1",
  } as (typeof ambiguous.ledger.products)[number]);
  expect(() => adaptWeb(ambiguous)).toThrow("E_BACKUP_REFS");
  const counter = webFixture();
  const counterClient = counter.ledger.clients[0];
  if (!counterClient) throw Error("Missing client");
  counterClient.id = "mostrador";
  expect(() => adaptWeb(counter)).toThrow("E_BACKUP_REFS");
  const orphan = webFixture();
  const orphanMove = orphan.ledger.movements[0];
  if (!orphanMove) throw Error("Missing movement");
  orphanMove.ref = "missing";
  expect(() => adaptWeb(orphan)).toThrow("E_BACKUP_REFS");
  const cost = webFixture();
  const wrongCost = cost.ledger.products[0];
  if (!wrongCost) throw Error("Missing product");
  wrongCost.lastCost = 0.3333333333333333;
  expect(() => adaptWeb(cost)).toThrow("E_BACKUP_COST");
});
it("preserves an exact fractional last-cost basis at zero stock and rejects fabricated closing totals", () => {
  const web = webFixture();
  const product = web.ledger.products[0];
  if (!product) throw Error("Missing product");
  product.stock = 0;
  product.value = 0;
  product.lastCost = 0.25;
  web.ledger.movements = web.ledger.movements.filter((m) => m.product !== 1);
  web.ledger.sales = web.ledger.sales.filter((s) => s.opening);
  web.ledger.payments = web.ledger.payments.filter((p) => p.opening);
  web.ledger.returns = [];
  web.ledger.outflows = [];
  const p = adaptWeb(web).backup.data.products[0];
  expect(p).toMatchObject({ lastValue: 1, lastQty: 4 });
  const closed = webFixture();
  const closing = closed.ledger.closings[0];
  if (!closing) throw Error("Missing closing");
  closing.ins = 1;
  expect(() => adaptWeb(closed)).toThrow("E_BACKUP_CLOSING");
});
it("preserves a removed historical bank snapshot across payment, reversal, return and purchase", () => {
  const web = webFixture(),
    historic = {
      id: "removed",
      name: "Anterior",
      bank: "Banco anterior",
      holder: "Titular anterior",
      clabe: "111111111111111111",
    };
  for (const p of web.ledger.payments.filter((p) => !p.opening))
    Object.assign(p, { method: "Transferencia", bank: "removed", bankSnapshot: historic });
  const returned = web.ledger.returns[0],
    purchase = web.ledger.outflows[0];
  if (!returned || !purchase) throw Error("Missing source records");
  Object.assign(returned, { method: "Transferencia", bank: "removed", bankSnapshot: historic });
  Object.assign(purchase, { bank: "removed", bankSnapshot: historic });
  web.ledger.outflows.push({
    ...purchase,
    id: "gasto-historico",
    kind: "Gasto",
    amount: 10,
    bankSnapshot: historic,
  } as typeof purchase);
  const backup = validateBackup(adaptWeb(web).backup, f.ctx.signal);
  for (const rows of [
    backup.data.payments.filter((p) => p.opening === 0),
    backup.data.payment_reversals,
    backup.data.returns,
    backup.data.purchases,
    backup.data.outflows,
  ])
    for (const row of rows)
      expect(JSON.parse(String(row.bankSnapshot))).toMatchObject({
        bank: "Banco anterior",
        clabe: historic.clabe,
      });
  expect(JSON.parse(String(backup.data.settings[0]?.data)).banks).toHaveLength(1);
  expect(JSON.parse(String(backup.data.settings[0]?.data)).banks[0].bank).toBe("Banco");
});

it("keeps text folios and skips exact legacy labels for new native sales, opening balances, payments and returns", async () => {
  const web = JSON.parse(JSON.stringify(webFixture()).replaceAll("VENTA-arbitraria", "V-000003"));
  f.input(encode(web));
  const response = await backupMethod(
    db,
    "backupPrepare",
    { token: "input", name: "folios.json" },
    f.ctx,
  );
  if (response.kind !== "ok") throw Error("Prepare failed");
  const p = preparedSchema.parse(response.value);
  expect(
    await backupMethod(
      db,
      "confirmRestore",
      { id: p.id, hash: p.hash, revision: p.revision, key: crypto.randomUUID() },
      f.ctx,
    ),
  ).toMatchObject({ kind: "ok" });
  const before = readDataset(db),
    clientId = String(before.data.clients[0]?.id),
    productId = String(before.data.products[0]?.id);
  function run(action: import("../shared/contracts.ts").Action) {
    const r = execute(
      db,
      { key: crypto.randomUUID(), revision: snapshot(db).revision, action },
      f.ctx.signal,
    );
    if (r.kind !== "ok") throw Error(r.issue.code);
    return r.value.id;
  }
  run({ type: "saveDraft", draft: { clientId, lines: [{ productId, qty: 1 }] } });
  const id = run({
    type: "sell",
    expectedTotal: 100,
    payment: { amount: 100, received: 100, method: "cash", bankId: null, reference: "" },
    exception: "",
  });
  expect(sale(db, id).folio).toBe(4);
  expect(db.get("SELECT 1 FROM origins WHERE legacyFolio='V-000003'")).toBeTruthy();
  const openingId = String(before.data.sales[0]?.id);
  db.run("UPDATE origins SET legacyFolio='SI-000005' WHERE entity='sales' AND id=?", openingId);
  expect(nextFolio(db, "sale", true)).toBe(6);
  const pay1 = String(before.data.payments[0]?.id),
    pay2 = String(before.data.payments[1]?.id);
  db.run("UPDATE origins SET legacyFolio='AB-5' WHERE entity='payments' AND id=?", pay1);
  db.run("UPDATE origins SET legacyFolio='PAY-6' WHERE entity='payments' AND id=?", pay2);
  expect(nextFolio(db, "payment")).toBe(7);
  const rid = String(before.data.returns[0]?.id);
  db.run("UPDATE origins SET legacyFolio='DEV-2' WHERE entity='returns' AND id=?", rid);
  expect(nextFolio(db, "return")).toBe(3);
  db.run("UPDATE origins SET legacyFolio='RET-4' WHERE entity='returns' AND id=?", rid);
  expect(nextFolio(db, "return")).toBe(5);
  expect(
    readDataset(db)
      .data.sales.filter((s) => s.id !== id)
      .map((s) => s.id),
  ).toEqual(before.data.sales.map((s) => s.id));
});
it("retains correction-order disclosure after Web1 to native export and preparation", async () => {
  f.input(encode(webFixture()));
  const prepared = await backupMethod(
    db,
    "backupPrepare",
    { token: "input", name: "web.json" },
    f.ctx,
  );
  if (prepared.kind !== "ok") throw Error("Prepare failed");
  const p = preparedSchema.parse(prepared.value);
  expect(p.limitations).toContain("correctionOrderUnknown");
  expect(
    await backupMethod(
      db,
      "confirmRestore",
      { id: p.id, hash: p.hash, revision: p.revision, key: crypto.randomUUID() },
      f.ctx,
    ),
  ).toMatchObject({ kind: "ok" });
  const exported = readDataset(db);
  f.input(encode(exported));
  const native = await backupMethod(
    db,
    "backupPrepare",
    { token: "input", name: "native.json" },
    f.ctx,
  );
  if (native.kind !== "ok") throw Error("Native prepare failed");
  expect(preparedSchema.parse(native.value).limitations).toContain("correctionOrderUnknown");
  expect(preparedSchema.parse(native.value).limitations).toContain("bank");
});
it("rejects an inconsistent positive-stock rational basis through the real API and adjusts an equivalent basis faithfully", async () => {
  const native = adaptWeb(webFixture()).backup,
    p = native.data.products.find((p) => p.kind === "simple");
  if (!p) throw Error("Missing product");
  const before = readDataset(db);
  p.lastValue = 999999;
  p.lastQty = 1;
  f.input(encode(native));
  expect(
    await backupMethod(db, "backupPrepare", { token: "input", name: "bad-ratio.json" }, f.ctx),
  ).toMatchObject({ kind: "rejected", issue: { code: "E_BACKUP_COST" } });
  expect(readDataset(db).data).toEqual(before.data);
  const historical = readDataset(db);
  historical.data.products.push({ ...p, id: crypto.randomUUID(), stock: 0, value: 0 });
  f.input(encode(historical));
  expect(
    await backupMethod(
      db,
      "backupPrepare",
      { token: "input", name: "zero-stock-cost.json" },
      f.ctx,
    ),
  ).toMatchObject({ kind: "ok" });
  p.lastValue = 200;
  p.lastQty = 2;
  f.input(encode(native));
  const prep = await backupMethod(
    db,
    "backupPrepare",
    { token: "input", name: "equivalent.json" },
    f.ctx,
  );
  if (prep.kind !== "ok") throw Error("Equivalent rational rejected");
  const accepted = preparedSchema.parse(prep.value);
  expect(
    await backupMethod(
      db,
      "confirmRestore",
      {
        id: accepted.id,
        hash: accepted.hash,
        revision: accepted.revision,
        key: crypto.randomUUID(),
      },
      f.ctx,
    ),
  ).toMatchObject({ kind: "ok" });
  const adjusted = execute(
    db,
    {
      key: crypto.randomUUID(),
      revision: snapshot(db).revision,
      action: {
        type: "adjust",
        productId: String(p.id),
        count: 5,
        waste: false,
        reason: "Conteo físico",
      },
    },
    f.ctx.signal,
  );
  expect(adjusted).toMatchObject({ kind: "ok" });
  expect(
    db.get("SELECT stock,value,lastValue,lastQty FROM products WHERE id=?", String(p.id)),
  ).toEqual({ stock: 5, value: 500, lastValue: 500, lastQty: 5 });
  f.output("rational-export");
  expect(await backupMethod(db, "backupExport", { token: "rational-export" }, f.ctx)).toMatchObject(
    { kind: "ok" },
  );
  const bytes = f.files.get("rational-export")?.bytes;
  if (!bytes) throw Error("Missing export");
  f.input(bytes);
  expect(
    await backupMethod(db, "backupPrepare", { token: "input", name: "roundtrip.json" }, f.ctx),
  ).toMatchObject({ kind: "ok" });
});
