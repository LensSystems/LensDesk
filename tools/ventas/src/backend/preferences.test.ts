import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Action } from "../shared/contracts.ts";
import { saleDetailSchema, statementSchema } from "../shared/history-contracts.ts";
import { normalizeSettings, settingsSchema } from "../shared/values.ts";
import { readDataset, replaceDataset } from "./backup-dataset.ts";
import { validateBackup } from "./backup-validation.ts";
import { type Db, memoryDatabase, openVentasDatabase } from "./db/driver.ts";
import { query } from "./queries.ts";
import { execute, snapshot } from "./service.ts";
import { adaptWeb } from "./web-backup.ts";
import { webFixture } from "./web-backup-fixture.ts";

let dir: string, db: Db;
const signal = new AbortController().signal;
const legacy = { name: "Original", address: "Calle", phone: "123", thanks: "Gracias", banks: [] };
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ventas-preferences-"));
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

describe("current preferences and historical compatibility", () => {
  it("migrates only current settings, retains old fingerprints and retries after restart and model5 restore", () => {
    const key = randomUUID(),
      action = { type: "saveSettings", settings: legacy } as const;
    const original = run(action, key);
    expect(
      db.get<{ fingerprint: string }>("SELECT fingerprint FROM operations WHERE key=?", key)
        ?.fingerprint,
    ).toBe(JSON.stringify(action));
    const client = run({
      type: "saveClient",
      client: { name: "Cliente", phone: "", term: 9, limit: null },
    }).value.id;
    run({
      type: "openingBalance",
      clientId: client,
      amount: 100,
      due: "2026-01-01",
      note: "Anterior",
    });
    db.run("UPDATE sales SET business=?", JSON.stringify(legacy));
    db.run("UPDATE settings SET data=? WHERE id=1", JSON.stringify(legacy));
    db.run("DELETE FROM schema_migrations WHERE version=6");
    const old = readDataset(db).data;
    db.close();
    db = openVentasDatabase(dir);
    expect(snapshot(db).settings).toEqual(normalizeSettings(legacy));
    expect(db.all("SELECT * FROM operations ORDER BY rowid")).toEqual(old.operations);
    expect(db.all("SELECT * FROM sales ORDER BY rowid")).toEqual(old.sales);
    expect(snapshot(db).clients[0]?.term).toBe(9);
    const revision = snapshot(db).revision;
    expect(execute(db, { key, revision: 0, action }, signal)).toEqual(original);
    expect(snapshot(db).revision).toBe(revision);
    const source = { ...readDataset(db), modelVersion: 5 as const };
    const sourceSettings = source.data.settings[0];
    if (!sourceSettings) throw Error("Missing settings");
    sourceSettings.data = JSON.stringify(legacy);
    const normalized = validateBackup(source, signal);
    expect(normalized.modelVersion).toBe(7);
    expect(normalized.data.sales).toEqual(old.sales);
    expect(normalized.data.operations).toEqual(old.operations);
    db.transaction(() => replaceDataset(db, normalized.data));
    expect(execute(db, { key, revision: 0, action }, signal)).toEqual(original);
    expect(readDataset(db).modelVersion).toBe(7);
    expect(validateBackup(readDataset(db), signal).data).toEqual(readDataset(db).data);
    expect(JSON.parse(String(readDataset(db).data.sales[0]?.business))).not.toHaveProperty(
      "cashier",
    );
  });
  it("validates zero/twenty banks, explicit IDs, default selection, aliases and strict terms", () => {
    const banks = Array.from({ length: 20 }, (_, i) => ({
      id: randomUUID(),
      bank: `Banco${i}`,
      holder: "Titular",
      clabe: "012345678901234567",
      alias: `Alias${i}`,
    }));
    expect(normalizeSettings(legacy)).toMatchObject({
      defaultTerm: 15,
      defaultBankId: null,
      cashier: "",
      ownerName: "",
      rfc: "",
    });
    expect(normalizeSettings({ ...legacy, banks }).defaultBankId).toBe(banks[0]?.id);
    expect(
      settingsSchema.parse({ ...legacy, banks, defaultBankId: banks[19]?.id }).banks,
    ).toHaveLength(20);
    expect(settingsSchema.safeParse({ ...legacy, banks: [...banks, banks[0]] }).success).toBe(
      false,
    );
    expect(settingsSchema.safeParse({ ...legacy, banks: [banks[0], banks[0]] }).success).toBe(
      false,
    );
    expect(
      settingsSchema.safeParse({ ...legacy, banks, defaultBankId: randomUUID() }).success,
    ).toBe(false);
    for (const defaultTerm of [0, 31, 1.5])
      expect(settingsSchema.safeParse({ ...legacy, defaultTerm }).success).toBe(false);
    const current = readDataset(db);
    const currentSettings = current.data.settings[0];
    if (!currentSettings) throw Error("Missing settings");
    currentSettings.data = JSON.stringify({
      ...normalizeSettings(legacy),
      defaultBankId: randomUUID(),
    });
    expect(() => validateBackup(current, signal)).toThrow("E_BACKUP_REFS");
    currentSettings.data = JSON.stringify(legacy);
    expect(() => validateBackup(current, signal)).toThrow("E_BACKUP_REFS");
    expect(() => validateBackup({ ...current, modelVersion: 8 }, signal)).toThrow(
      "E_BACKUP_FORMAT",
    );
  });
  it("returns a legacy result before applying new current-settings reference constraints", () => {
    const key = randomUUID();
    const result = run({ type: "saveSettings", settings: legacy }, key);
    const bank = {
      id: randomUUID(),
      bank: "Banco",
      holder: "Titular",
      clabe: "012345678901234567",
    };
    const action = { type: "saveSettings", settings: { ...legacy, banks: [bank, bank] } } as const;
    db.run("UPDATE operations SET fingerprint=? WHERE key=?", JSON.stringify(action), key);
    expect(execute(db, { key, revision: 0, action }, signal)).toEqual(result);
    expect(() =>
      execute(db, { key: randomUUID(), revision: snapshot(db).revision, action }, signal),
    ).toThrow("Invalid settings references");
    expect(snapshot(db).settings.banks).toEqual([]);
    expect(db.all("SELECT * FROM operations")).toHaveLength(1);
  });
  it("reads and restores an old sale with duplicated historical banks without changing its bytes", () => {
    const cid = run({
      type: "saveClient",
      client: { name: "Histórico", phone: "", term: 15, limit: null },
    }).value.id;
    const sid = run({
      type: "openingBalance",
      clientId: cid,
      amount: 100,
      due: "2026-01-01",
      note: "Anterior",
    }).value.id;
    const bank = {
      id: randomUUID(),
      bank: "Banco histórico",
      holder: "Titular",
      clabe: "012345678901234567",
    };
    const original = JSON.stringify({ ...legacy, banks: [bank, bank] });
    db.run("UPDATE sales SET business=? WHERE id=?", original, sid);
    const detail = query(db, "saleDetail", { saleId: sid }, signal);
    const statement = query(db, "statement", { clientId: cid }, signal);
    if (detail.kind !== "ok" || statement.kind !== "ok") throw Error("Unexpected query rejection");
    expect(saleDetailSchema.parse(detail.value).sale.business.banks).toHaveLength(2);
    expect(statementSchema.parse(statement.value).sales[0]?.business.banks).toHaveLength(2);
    const backup = validateBackup(readDataset(db), signal);
    expect(backup.data.sales[0]?.business).toBe(original);
    db.transaction(() => replaceDataset(db, backup.data));
    expect(
      db.get<{ business: string }>("SELECT business FROM sales WHERE id=?", sid)?.business,
    ).toBe(original);
    expect(snapshot(db).settings.banks).toEqual([]);
  });
  it("imports available Web1 preferences and the sale's own cashier without inflating older history", () => {
    const raw = webFixture();
    const sale = raw.ledger.sales[1];
    if (!sale) throw Error("Missing sale");
    Object.assign(sale, {
      cashier: "Cajero histórico",
      business: { ...raw.business, cashier: "Otro histórico" },
    });
    raw.business.cashier = "Cajero actual";
    raw.business.defaultTerm = "21 días";
    const { backup } = adaptWeb(raw);
    const validated = validateBackup(backup, signal);
    const settings = JSON.parse(String(validated.data.settings[0]?.data));
    expect(settings).toMatchObject({
      ownerName: "Dueña",
      rfc: "RFC",
      cashier: "Cajero actual",
      defaultTerm: 21,
    });
    expect(settings.defaultBankId).toBe(settings.banks[0].id);
    expect(settings.banks[0].alias).toBe("Principal");
    expect(JSON.parse(String(validated.data.sales[1]?.business)).cashier).toBe("Cajero histórico");
    expect(JSON.parse(String(validated.data.sales[0]?.business))).not.toHaveProperty("cashier");
    expect(JSON.parse(String(validated.data.import_archives[0]?.payload))).toEqual(raw);
    raw.business.defaultTerm = "21 días basura";
    expect(() => adaptWeb(raw)).toThrow();
    const other = memoryDatabase();
    try {
      expect(snapshot(other).settings.banks).toEqual([]);
    } finally {
      other.close();
    }
  });
});
