import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BACKUP_BYTES, type NativeBackup, preparedSchema } from "../shared/backup-contracts.ts";
import type { Action } from "../shared/contracts.ts";
import { readDataset } from "./backup-dataset.ts";
import { decode, encode, hash } from "./backup-json.ts";
import { backupMethod } from "./backup-service.ts";
import { fileContext } from "./backup-test-context.ts";
import { validateBackup } from "./backup-validation.ts";
import { type Db, openVentasDatabase } from "./db/driver.ts";
import { execute, snapshot } from "./service.ts";
import { webFixture } from "./web-backup-fixture.ts";

let db: Db, dir: string, f: ReturnType<typeof fileContext>;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ventas-backup-test-"));
  db = openVentasDatabase(dir);
  f = fileContext(dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
  vi.useRealTimers();
});
function run(action: Action) {
  const r = execute(
    db,
    { key: randomUUID(), revision: snapshot(db).revision, action },
    f.ctx.signal,
  );
  if (r.kind !== "ok") throw Error(r.issue.code);
  return r.value.id;
}
async function prepare(backup: unknown = readDataset(db)) {
  f.input(encode(backup));
  const r = await backupMethod(
    db,
    "backupPrepare",
    { token: "input", name: "respaldo.json" },
    f.ctx,
  );
  if (r.kind !== "ok") throw Error(JSON.stringify(r));
  return preparedSchema.parse(r.value);
}
const confirm = (p: Awaited<ReturnType<typeof prepare>>, key = randomUUID()) => ({
  id: p.id,
  hash: p.hash,
  revision: p.revision,
  key,
});
function saleFixture() {
  run({ type: "openCash", initial: 10000 });
  const pid = run({
    type: "saveProduct",
    product: {
      name: "Gomitas",
      category: "Dulces",
      kind: "simple",
      unit: "piece",
      price: 100,
      minStock: 0,
    },
  });
  run({ type: "receive", productId: pid, qty: 3, cost: 100, method: "cash", bankId: null });
  const cid = run({
    type: "saveClient",
    client: { name: "Cliente", phone: "", term: 15, limit: null },
  });
  run({ type: "saveDraft", draft: { clientId: cid, lines: [{ productId: pid, qty: 3 }] } });
  const sid = run({
    type: "sell",
    expectedTotal: 300,
    payment: { amount: 100, received: 100, method: "cash", bankId: null, reference: "" },
    exception: "",
  });
  return { pid, cid, sid };
}

describe("Ventas full backup and restoration", () => {
  it("exports full tables and preserves UUIDs, operations, all history and previous copy", async () => {
    const bankId = randomUUID(),
      bank = { id: bankId, bank: "Banco", holder: "Titular", clabe: "012345678901234567" };
    run({
      type: "saveSettings",
      settings: { name: "Negocio", address: "", phone: "", thanks: "", banks: [bank] },
    });
    db.transaction(() => {
      for (let n = 0; n < 1100; n++)
        db.run(
          "INSERT INTO outflows VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
          randomUUID(),
          "expense",
          "Histórico",
          "Otros",
          1,
          "transfer",
          bankId,
          JSON.stringify(bank),
          null,
          "2026-11-07T18:00:00Z",
          "2026-11-07",
          "R",
        );
    });
    for (let n = 0; n < 26; n++) {
      const id = randomUUID(),
        at = "2026-11-07T18:00:00.000Z",
        date = "2026-11-07";
      db.run(
        "INSERT INTO cash_sessions VALUES(?,?,?,?,?)",
        id,
        0,
        at,
        date,
        JSON.stringify({
          id,
          initial: 0,
          at,
          date,
          ins: 0,
          purchases: 0,
          expenses: 0,
          withdrawals: 0,
          outs: 0,
          refunds: 0,
          reversals: 0,
          expected: 0,
          counted: 0,
          difference: 0,
          reason: "",
          closedAt: at,
          closedDate: date,
        }),
      );
    }
    const source = readDataset(db);
    expect(source.data.cash_sessions).toHaveLength(26);
    expect(snapshot(db).closings).toHaveLength(20);
    expect(source.data.outflows).toHaveLength(1100);
    f.output();
    expect(await backupMethod(db, "backupExport", { token: "output" }, f.ctx)).toMatchObject({
      kind: "ok",
    });
    expect(
      (decode(f.files.get("output")?.bytes ?? new Uint8Array()) as NativeBackup).data.outflows,
    ).toHaveLength(1100);
    const p = await prepare(source),
      request = confirm(p),
      before = readDataset(db);
    expect(await backupMethod(db, "confirmRestore", request, f.ctx)).toMatchObject({ kind: "ok" });
    const restored = readDataset(db);
    expect(restored.data.outflows).toEqual(source.data.outflows);
    expect(restored.data.operations).toEqual(source.data.operations);
    expect(restored.revision).toBe(before.revision + 1);
    f.output("previous");
    expect(
      await backupMethod(db, "backupExport", { token: "previous", previous: true }, f.ctx),
    ).toMatchObject({ kind: "ok" });
    expect(
      (decode(f.files.get("previous")?.bytes ?? new Uint8Array()) as NativeBackup).data,
    ).toEqual(before.data);
    const once = readDataset(db);
    db.close();
    db = openVentasDatabase(dir);
    expect(await backupMethod(db, "confirmRestore", request, f.ctx)).toMatchObject({ kind: "ok" });
    expect(readDataset(db)).toMatchObject({ revision: once.revision, data: once.data });
  });
  it("retains valid reversal history when a later payment funds a subsequent refund", async () => {
    const { sid, cid } = saleFixture(),
      p1 = db.get<{ id: string }>("SELECT id FROM payments")?.id;
    if (!p1) throw Error("Missing payment");
    run({ type: "reversePayment", paymentId: p1, reason: "Duplicado" });
    run({
      type: "payAccount",
      clientId: cid,
      payment: { amount: 300, received: 300, method: "cash", bankId: null, reference: "P2" },
    });
    const line = JSON.parse(
      String(db.get<{ lines: string }>("SELECT lines FROM sales WHERE id=?", sid)?.lines),
    )[0] as { id: string };
    run({
      type: "returnSale",
      saleId: sid,
      items: [{ lineId: line.id, qty: 1 }],
      restock: true,
      reason: "Después del nuevo pago",
      refund: { method: "cash", bankId: null, reference: "" },
    });
    const source = readDataset(db);
    expect(validateBackup(source, f.ctx.signal).data).toEqual(source.data);
    const p = await prepare(source);
    expect(await backupMethod(db, "confirmRestore", confirm(p), f.ctx)).toMatchObject({
      kind: "ok",
    });
    expect(snapshot(db).accounts[0]?.balance).toBe(0);
  });
  it("rejects wrong cumulative return cost and uses folio order despite a backwards clock", () => {
    const { sid } = saleFixture(),
      line = JSON.parse(
        String(db.get<{ lines: string }>("SELECT lines FROM sales WHERE id=?", sid)?.lines),
      )[0] as { id: string };
    run({
      type: "returnSale",
      saleId: sid,
      items: [{ lineId: line.id, qty: 1 }],
      restock: true,
      reason: "Primera",
      refund: { method: "cash", bankId: null, reference: "" },
    });
    run({
      type: "returnSale",
      saleId: sid,
      items: [{ lineId: line.id, qty: 1 }],
      restock: true,
      reason: "Segunda",
      refund: { method: "cash", bankId: null, reference: "" },
    });
    const source = readDataset(db);
    if (source.data.returns[1]) {
      source.data.returns[1].date = "2020-01-01";
      source.data.returns[1].at = "2020-01-01T18:00:00.000Z";
    }
    expect(() => validateBackup(source, f.ctx.signal)).not.toThrow();
    if (source.data.return_lines[0]) source.data.return_lines[0].cost = 10;
    expect(() => validateBackup(source, f.ctx.signal)).toThrow("E_BACKUP_REFS");
  });
  it("rejects changed bytes, concurrent revision and expired preparation without mutation", async () => {
    const p = await prepare(),
      before = readDataset(db);
    f.input(new TextEncoder().encode("{}"));
    expect(await backupMethod(db, "confirmRestore", confirm(p), f.ctx)).toMatchObject({
      kind: "rejected",
      issue: { code: "E_BACKUP_CHANGED" },
    });
    expect(readDataset(db).data).toEqual(before.data);
    const p2 = await prepare();
    run({ type: "openCash", initial: 0 });
    expect(await backupMethod(db, "confirmRestore", confirm(p2), f.ctx)).toMatchObject({
      kind: "rejected",
      issue: { code: "E_REVISION" },
    });
    const p3 = await prepare();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 600001);
    expect(await backupMethod(db, "confirmRestore", confirm(p3), f.ctx)).toMatchObject({
      kind: "rejected",
      issue: { code: "E_BACKUP_EXPIRED" },
    });
  });
  it("preserves cancellation and enforces token ownership and mode", async () => {
    const source = readDataset(db),
      controller = new AbortController();
    controller.abort();
    expect(() => validateBackup(source, controller.signal)).toThrowError(
      expect.objectContaining({ code: "E_CANCELLED" }),
    );
    f.output();
    await expect(
      backupMethod(db, "backupPrepare", { token: "output", name: "x" }, f.ctx),
    ).rejects.toMatchObject({ code: "E_PATH_NOT_GRANTED" });
    f.input(encode(source));
    await expect(backupMethod(db, "backupExport", { token: "input" }, f.ctx)).rejects.toMatchObject(
      { code: "E_PATH_NOT_GRANTED" },
    );
    f.files.set("foreign", { bytes: encode(source), mode: "read", owner: "notes" });
    await expect(
      backupMethod(db, "backupPrepare", { token: "foreign", name: "x" }, f.ctx),
    ).rejects.toMatchObject({ code: "E_PATH_NOT_GRANTED" });
  });
  it("rolls back if copy, insertion, or commit fails, and retains the last confirmed copy", async () => {
    const p = await prepare(),
      request = confirm(p),
      before = readDataset(db);
    writeFileSync(join(dir, "restore-backups"), "blocked");
    expect(await backupMethod(db, "confirmRestore", request, f.ctx)).toMatchObject({
      kind: "rejected",
      issue: { code: "E_BACKUP_COPY" },
    });
    expect(readDataset(db).data).toEqual(before.data);
    rmSync(join(dir, "restore-backups"));
    mkdirSync(join(dir, "restore-backups"));
    const transaction = db.transaction;
    db.transaction = (work) =>
      transaction(() => {
        const result = work();
        if (db.get("SELECT 1 FROM restore_receipts WHERE key=?", request.key))
          throw Error("Commit failed");
        return result;
      });
    await expect(backupMethod(db, "confirmRestore", request, f.ctx)).rejects.toThrow(
      "Commit failed",
    );
    db.transaction = transaction;
    expect(readDataset(db).data).toEqual(before.data);
    expect(db.all("SELECT * FROM restore_receipts")).toEqual([]);
  });
  it("guards JSON duplicates, hostile keys, future models, depth, UTF8 and actual byte boundaries", async () => {
    for (const input of [
      '{"a":1,"a":2}',
      '{"__proto__":{}}',
      '{"amount":1.00000000000000000001}',
      `${"[".repeat(52)}0${"]".repeat(52)}`,
    ])
      expect(() => decode(new TextEncoder().encode(input))).toThrow("E_BACKUP_FORMAT");
    expect(() => decode(new Uint8Array([0xff]))).toThrow("E_BACKUP_FORMAT");
    const bytes = new Uint8Array(MAX_BACKUP_BYTES).fill(32);
    bytes.set(new TextEncoder().encode("null"));
    expect(decode(bytes)).toBeNull();
    expect(() => decode(new Uint8Array(MAX_BACKUP_BYTES + 1))).toThrow("E_BACKUP_LIMIT");
    expect(() => encode("é".repeat(MAX_BACKUP_BYTES))).toThrow("E_BACKUP_LIMIT");
    const source = readDataset(db);
    expect(() => validateBackup({ ...source, modelVersion: 6 }, f.ctx.signal)).toThrow(
      "E_BACKUP_FORMAT",
    );
  });
});
it("serializes overlapping confirmations and never removes the winning prior copy", async () => {
  const p = await prepare(),
    request = confirm(p);
  const results = await Promise.all([
    backupMethod(db, "confirmRestore", request, f.ctx),
    backupMethod(db, "confirmRestore", request, f.ctx),
  ]);
  expect(results[0]).toEqual(results[1]);
  expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(1);
  f.output("prior1");
  expect(
    await backupMethod(db, "backupExport", { token: "prior1", previous: true }, f.ctx),
  ).toMatchObject({ kind: "ok" });
  const p2 = await prepare();
  const competing = await Promise.all([
    backupMethod(db, "confirmRestore", confirm(p2), f.ctx),
    backupMethod(db, "confirmRestore", confirm(p2), f.ctx),
  ]);
  expect(competing.filter((r) => r.kind === "ok")).toHaveLength(1);
  f.output("prior2");
  expect(
    await backupMethod(db, "backupExport", { token: "prior2", previous: true }, f.ctx),
  ).toMatchObject({ kind: "ok" });
});
it("resolves cancellation at the commit boundary from its durable receipt after restart", async () => {
  const p = await prepare(),
    request = confirm(p),
    controller = new AbortController(),
    ctx = { ...f.ctx, signal: controller.signal },
    transaction = db.transaction;
  db.transaction = (work) =>
    transaction(() => {
      const result = work();
      if (db.get("SELECT 1 FROM restore_receipts WHERE key=?", request.key)) controller.abort();
      return result;
    });
  expect(await backupMethod(db, "confirmRestore", request, ctx)).toMatchObject({ kind: "ok" });
  db.transaction = transaction;
  const once = readDataset(db);
  expect(controller.signal.aborted).toBe(true);
  db.close();
  db = openVentasDatabase(dir);
  expect(await backupMethod(db, "confirmRestore", request, f.ctx)).toMatchObject({ kind: "ok" });
  expect(readDataset(db).data).toEqual(once.data);
  expect(snapshot(db).revision).toBe(once.revision);
});
it("rolls back a failed row insertion and keeps the previous dataset", async () => {
  const p = await prepare(),
    request = confirm(p),
    before = readDataset(db),
    run = db.run;
  db.run = (sql, ...values) => {
    if (sql.startsWith("INSERT INTO main.products(")) throw Error("Insert failed");
    run(sql, ...values);
  };
  // A settings row exists even in a fresh dataset; fail its insertion after deletes.
  db.run = (sql, ...values) => {
    if (sql.startsWith("INSERT INTO main.settings(")) throw Error("Insert failed");
    run(sql, ...values);
  };
  await expect(backupMethod(db, "confirmRestore", request, f.ctx)).rejects.toThrow("Insert failed");
  db.run = run;
  expect(readDataset(db).data).toEqual(before.data);
  expect(db.all("SELECT * FROM restore_receipts")).toEqual([]);
});
it("reports progress and cancels a large prepared file before changing data", async () => {
  const source = readDataset(db);
  for (let n = 0; n < 1100; n++)
    source.data.restore_history.push({
      id: randomUUID(),
      sourceHash: "a".repeat(64),
      at: "2026-11-07T18:00:00.000Z",
      sourceRevision: n,
    });
  f.input(encode(source));
  const controller = new AbortController(),
    phases: string[] = [],
    start = performance.now();
  const ctx = {
    ...f.ctx,
    signal: controller.signal,
    progress: (_fraction: number, phase?: string) => {
      phases.push(phase ?? "");
      if (phase === "reconciling") controller.abort();
    },
  };
  await expect(
    backupMethod(db, "backupPrepare", { token: "input", name: "large.json" }, ctx),
  ).rejects.toMatchObject({ code: "E_CANCELLED" });
  expect(phases).toContain("reconciling");
  expect(db.all("SELECT * FROM restore_history")).toHaveLength(0);
  expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(0);
  expect(performance.now() - start).toBeLessThan(10000);
});
it("exports a valid native file at exactly twenty MiB with Unicode byte accounting", async () => {
  const raw = webFixture() as ReturnType<typeof webFixture> & { extra: string };
  raw.extra = "";
  const archiveId = randomUUID(),
    base = readDataset(db),
    row = { id: archiveId, format: "web1", hash: "a".repeat(64), payload: JSON.stringify(raw) };
  base.data.import_archives.push(row);
  const available = MAX_BACKUP_BYTES - encode(base).length;
  raw.extra = "é".repeat(Math.floor(available / 2)) + "x".repeat(available % 2);
  row.payload = JSON.stringify(raw);
  row.hash = hash(new TextEncoder().encode(row.payload));
  expect(encode(base)).toHaveLength(MAX_BACKUP_BYTES);
  db.run("INSERT INTO import_archives VALUES(?,?,?,?)", row.id, row.format, row.hash, row.payload);
  f.output();
  expect(await backupMethod(db, "backupExport", { token: "output" }, f.ctx)).toMatchObject({
    kind: "ok",
    value: { bytes: MAX_BACKUP_BYTES },
  });
  expect(f.files.get("output")?.bytes).toHaveLength(MAX_BACKUP_BYTES);
});
it("rejects admitted Web1 input when provenance plus normalization would exceed twenty MiB", async () => {
  const raw = webFixture() as ReturnType<typeof webFixture> & { extra: string };
  raw.extra = "\\".repeat(6 * 1024 * 1024);
  const input = encode(raw),
    before = readDataset(db);
  expect(input.length).toBeLessThan(MAX_BACKUP_BYTES);
  f.input(input);
  expect(
    await backupMethod(db, "backupPrepare", { token: "input", name: "large-web.json" }, f.ctx),
  ).toMatchObject({ kind: "rejected", issue: { code: "E_BACKUP_LIMIT" } });
  expect(readDataset(db).data).toEqual(before.data);
  expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(0);
});
it("propagates export disk-full failures and rejects a damaged prior copy", async () => {
  const before = readDataset(db);
  f.output();
  const write = f.ctx.files.writeBytes;
  f.ctx.files.writeBytes = async () => {
    throw Object.assign(Error("Disk full"), { code: "ENOSPC" });
  };
  await expect(backupMethod(db, "backupExport", { token: "output" }, f.ctx)).rejects.toMatchObject({
    code: "ENOSPC",
  });
  f.ctx.files.writeBytes = write;
  expect(readDataset(db).data).toEqual(before.data);
  const p = await prepare();
  expect(await backupMethod(db, "confirmRestore", confirm(p), f.ctx)).toMatchObject({ kind: "ok" });
  const prior = db.get<{ backupId: string }>(
    "SELECT backupId FROM restore_receipts ORDER BY rowid DESC LIMIT 1",
  );
  if (!prior) throw Error("Missing receipt");
  writeFileSync(join(dir, "restore-backups", `${prior.backupId}.json`), "corrupt");
  const restored = readDataset(db);
  expect(
    await backupMethod(db, "backupExport", { token: "output", previous: true }, f.ctx),
  ).toMatchObject({ kind: "rejected", issue: { code: "E_BACKUP_COPY" } });
  expect(readDataset(db).data).toEqual(restored.data);
});
it("invalidates a superseded preparation instead of confirming the old preview", async () => {
  const first = await prepare(),
    second = await prepare();
  expect(first.id).not.toBe(second.id);
  expect(await backupMethod(db, "confirmRestore", confirm(first), f.ctx)).toMatchObject({
    kind: "rejected",
    issue: { code: "E_BACKUP_EXPIRED" },
  });
  expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(0);
});
it("validates every historical JSON contract beyond the fifty-row UI limit", () => {
  const source = readDataset(db),
    bankId = randomUUID(),
    bank = { id: bankId, bank: "Banco", holder: "Titular", clabe: "012345678901234567" };
  source.data.outflows = Array.from({ length: 51 }, (_, n) => ({
    id: randomUUID(),
    kind: "expense",
    concept: `Gasto ${n}`,
    category: "Otros",
    amount: 1,
    method: "transfer",
    bankId,
    bankSnapshot: JSON.stringify(bank),
    cashId: null,
    at: `2026-11-07T18:00:${String(n).padStart(2, "0")}.000Z`,
    date: "2026-11-07",
    reference: "",
  }));
  expect(() => validateBackup(source, f.ctx.signal)).not.toThrow();
  const oldest = source.data.outflows[0];
  if (!oldest) throw Error("Missing oldest");
  oldest.bankSnapshot = "no-json";
  expect(() => validateBackup(source, f.ctx.signal)).toThrow("E_BACKUP_REFS");
  oldest.bankSnapshot = "123";
  expect(() => validateBackup(source, f.ctx.signal)).toThrow("E_BACKUP_REFS");
  oldest.bankSnapshot = JSON.stringify(bank);
  oldest.kind = "unknown";
  expect(() => validateBackup(source, f.ctx.signal)).toThrow("E_BACKUP_REFS");
  const { sid } = saleFixture(),
    full = readDataset(db);
  for (const table of ["sales", "payments", "purchases"] as const) {
    const corrupted = structuredClone(full),
      row = corrupted.data[table][0];
    if (!row) throw Error("Missing history");
    row[table === "sales" ? "business" : "bankSnapshot"] = "no-json";
    expect(() => validateBackup(corrupted, f.ctx.signal)).toThrow("E_BACKUP_REFS");
  }
  expect(sid).toBeTruthy();
});
it("rejects counter debt and overpayment even when account summaries exclude the counter", () => {
  run({ type: "openCash", initial: 1000 });
  const pid = run({
    type: "saveProduct",
    product: {
      name: "Contado",
      category: "Otros",
      kind: "simple",
      unit: "piece",
      price: 100,
      minStock: 0,
    },
  });
  run({ type: "receive", productId: pid, qty: 1, cost: 10, method: "cash", bankId: null });
  run({ type: "saveDraft", draft: { clientId: null, lines: [{ productId: pid, qty: 1 }] } });
  const sid = run({
    type: "sell",
    expectedTotal: 100,
    payment: { amount: 100, received: 100, method: "cash", bankId: null, reference: "" },
    exception: "",
  });
  const valid = readDataset(db);
  expect(() => validateBackup(valid, f.ctx.signal)).not.toThrow();
  const unpaid = structuredClone(valid),
    s = unpaid.data.sales.find((s) => s.id === sid);
  if (!s) throw Error("Missing sale");
  s.initialPaymentId = null;
  s.received = 0;
  s.change = 0;
  unpaid.data.payments = [];
  unpaid.data.payment_allocations = [];
  expect(() => validateBackup(unpaid, f.ctx.signal)).toThrow("E_BACKUP_REFS");
  const over = structuredClone(valid);
  if (over.data.payments[0]) over.data.payments[0].amount = 200;
  if (over.data.payment_allocations[0]) over.data.payment_allocations[0].amount = 200;
  expect(() => validateBackup(over, f.ctx.signal)).toThrow("E_BACKUP_REFS");
  const original = JSON.parse(
    String(db.get<{ lines: string }>("SELECT lines FROM sales WHERE id=?", sid)?.lines),
  )[0] as { id: string };
  run({
    type: "returnSale",
    saleId: sid,
    items: [{ lineId: original.id, qty: 1 }],
    restock: true,
    reason: "Total devuelta",
    refund: { method: "cash", bankId: null, reference: "" },
  });
  expect(() => validateBackup(readDataset(db), f.ctx.signal)).not.toThrow();
});
it("validates original tender/change and initial payment linkage without guessing unknown web history", () => {
  saleFixture();
  const valid = readDataset(db),
    sale = valid.data.sales[0];
  if (!sale) throw Error("Missing sale");
  sale.change = 99;
  expect(() => validateBackup(valid, f.ctx.signal)).toThrow("E_BACKUP_REFS");
  sale.change = 0;
  sale.received = 99;
  expect(() => validateBackup(valid, f.ctx.signal)).toThrow("E_BACKUP_REFS");
  sale.received = 100;
  expect(() => validateBackup(valid, f.ctx.signal)).not.toThrow();
  const wrong = structuredClone(valid),
    payment = wrong.data.payments[0];
  if (!payment) throw Error("Missing payment");
  payment.method = "transfer";
  sale.change = 1;
  expect(() => validateBackup(valid, f.ctx.signal)).toThrow("E_BACKUP_REFS");
  expect(() => validateBackup(wrong, f.ctx.signal)).not.toThrow();
  const bank = {
      id: randomUUID(),
      bank: "Histórico",
      holder: "Titular",
      clabe: "012345678901234567",
    },
    s = wrong.data.sales[0];
  if (!s) throw Error("Missing sale");
  payment.bankId = bank.id;
  payment.bankSnapshot = JSON.stringify(bank);
  s.business = JSON.stringify({
    name: "Anterior",
    address: "",
    phone: "",
    thanks: "",
    banks: [bank],
  });
  expect(() => validateBackup(wrong, f.ctx.signal)).not.toThrow();
  payment.bankSnapshot = JSON.stringify({ ...bank, holder: "Nombre incoherente" });
  expect(() => validateBackup(wrong, f.ctx.signal)).toThrow("E_BACKUP_REFS");
});
it("requires portable singleton rows and revision rather than creating fallback data", () => {
  for (const table of ["draft", "settings"] as const) {
    const source = readDataset(db);
    source.data[table] = [];
    expect(() => validateBackup(source, f.ctx.signal)).toThrow("E_BACKUP_REFS");
  }
  const source = readDataset(db),
    { revision: _revision, ...missing } = source;
  expect(() => validateBackup(missing, f.ctx.signal)).toThrow("E_BACKUP_FORMAT");
  db.run("DELETE FROM meta");
  expect(() => readDataset(db)).toThrow("E_BACKUP_REFS");
});
it("treats an actual deleted source as a terminal pre-write rejection and permits reselection", async () => {
  const first = await prepare();
  expect(await backupMethod(db, "confirmRestore", confirm(first), f.ctx)).toMatchObject({
    kind: "ok",
  });
  const before = readDataset(db),
    receipts = db.all("SELECT * FROM restore_receipts"),
    path = join(dir, "source.json");
  writeFileSync(path, encode(before));
  const read = f.ctx.files.readBytes;
  f.ctx.files.readBytes = async () =>
    new Uint8Array(await import("node:fs/promises").then((fs) => fs.readFile(path)));
  const r = await backupMethod(
    db,
    "backupPrepare",
    { token: "actual-file", name: "source.json" },
    f.ctx,
  );
  if (r.kind !== "ok") throw Error("Prepare failed");
  const p = preparedSchema.parse(r.value);
  rmSync(path);
  expect(await backupMethod(db, "confirmRestore", confirm(p), f.ctx)).toMatchObject({
    kind: "rejected",
    issue: { code: "E_BACKUP_SOURCE" },
  });
  expect(readDataset(db).data).toEqual(before.data);
  expect(db.all("SELECT * FROM restore_receipts")).toEqual(receipts);
  f.output("previous-deleted");
  expect(
    await backupMethod(db, "backupExport", { token: "previous-deleted", previous: true }, f.ctx),
  ).toMatchObject({ kind: "ok" });
  f.ctx.files.readBytes = read;
  expect(await prepare()).toMatchObject({ revision: before.revision });
});
it("terminates a permanent token read failure without copying or replacing data", async () => {
  const p = await prepare(),
    before = readDataset(db);
  f.ctx.files.readBytes = async () => {
    throw new Error("Permanent unreadable token");
  };
  expect(await backupMethod(db, "confirmRestore", confirm(p), f.ctx)).toMatchObject({
    kind: "rejected",
    issue: { code: "E_BACKUP_SOURCE" },
  });
  expect(readDataset(db).data).toEqual(before.data);
  expect(db.all("SELECT * FROM restore_receipts")).toEqual([]);
});
it("rejects a revision changed by execute during TEMP staging and preserves the last previous copy", async () => {
  const baseline = await prepare();
  expect(await backupMethod(db, "confirmRestore", confirm(baseline), f.ctx)).toMatchObject({
    kind: "ok",
  });
  f.output("old-copy");
  await backupMethod(db, "backupExport", { token: "old-copy", previous: true }, f.ctx);
  const oldCopy = f.files.get("old-copy")?.bytes,
    receipts = db.all("SELECT * FROM restore_receipts"),
    indexes = db.all("SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name"),
    source = readDataset(db);
  source.data.products = Array.from({ length: 1000 }, (_, n) => ({
    id: randomUUID(),
    name: `Producto ${n}`,
    category: "Otros",
    kind: "simple",
    unit: "piece",
    price: 1,
    minStock: 0,
    stock: 0,
    value: 0,
    lastValue: 0,
    lastQty: 1,
    active: 1,
  }));
  const p = await prepare(source);
  let timer: ReturnType<typeof setTimeout> | undefined,
    observed = -1;
  const ctx = {
    ...f.ctx,
    progress: (_n: number, phase?: string) => {
      if (phase === "staging")
        timer = setTimeout(() => {
          observed = snapshot(db).products.length;
          run({ type: "openCash", initial: 17 });
        }, 0);
    },
  };
  try {
    expect(await backupMethod(db, "confirmRestore", confirm(p), ctx)).toMatchObject({
      kind: "rejected",
      issue: { code: "E_REVISION" },
    });
    expect(observed).toBe(0);
    expect(
      db.all("SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name"),
    ).toEqual(indexes);
    expect(snapshot(db).products).toHaveLength(0);
    expect(snapshot(db).cash?.initial).toBe(17);
    expect(db.all("SELECT * FROM restore_receipts")).toEqual(receipts);
    expect(
      db.all("SELECT name FROM sqlite_temp_master WHERE name LIKE 'ventas_restore_%'"),
    ).toHaveLength(0);
    f.output("kept-copy");
    await backupMethod(db, "backupExport", { token: "kept-copy", previous: true }, f.ctx);
    expect(f.files.get("kept-copy")?.bytes).toEqual(oldCopy);
  } finally {
    clearTimeout(timer);
  }
});
it.each(["value", "type"])(
  "rolls back a %s difference between validated TEMP rows and the atomic target",
  async (difference) => {
    const p = await prepare(),
      before = readDataset(db),
      indexes = db.all("SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name"),
      run = db.run;
    let changed = false;
    db.run = (sql, ...values) => {
      run(sql, ...values);
      if (!changed && sql.startsWith("INSERT INTO main.settings(")) {
        changed = true;
        if (difference === "type")
          run("UPDATE main.settings SET data=CAST(data AS BLOB) WHERE id=1");
        else
          run(
            "UPDATE main.settings SET data=? WHERE id=1",
            JSON.stringify({ name: "Alterado", address: "", phone: "", thanks: "", banks: [] }),
          );
      }
    };
    expect(await backupMethod(db, "confirmRestore", confirm(p), f.ctx)).toMatchObject({
      kind: "rejected",
      issue: { code: "E_BACKUP_REFS" },
    });
    db.run = run;
    expect(readDataset(db).data).toEqual(before.data);
    expect(
      db.all("SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name"),
    ).toEqual(indexes);
    expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(0);
    expect(
      db.all("SELECT name FROM sqlite_temp_master WHERE name LIKE 'ventas_restore_%'"),
    ).toHaveLength(0);
  },
);
it("restores all installed index definitions if rebuilding a lookup index fails", async () => {
  const p = await prepare(),
    before = readDataset(db),
    indexes = db.all("SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name"),
    run = db.run;
  let injected = false;
  db.run = (sql, ...values) => {
    if (!injected && /^CREATE INDEX /i.test(sql)) {
      injected = true;
      throw Error("Index rebuild failed");
    }
    run(sql, ...values);
  };
  try {
    await expect(backupMethod(db, "confirmRestore", confirm(p), f.ctx)).rejects.toThrow(
      "Index rebuild failed",
    );
  } finally {
    db.run = run;
  }
  expect(injected).toBe(true);
  expect(readDataset(db).data).toEqual(before.data);
  expect(readDataset(db).revision).toBe(before.revision);
  expect(
    db.all("SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name"),
  ).toEqual(indexes);
  expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(0);
  expect(
    db.all("SELECT name FROM sqlite_temp_master WHERE name LIKE 'ventas_restore_%'"),
  ).toHaveLength(0);
});
