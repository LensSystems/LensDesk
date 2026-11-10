import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { currentSettingsSchema, normalizeSettings } from "../shared/values.ts";
import { readDataset, replaceDataset } from "./backup-dataset.ts";
import { validateBackup } from "./backup-validation.ts";
import { type Db, openVentasDatabase } from "./db/driver.ts";
import { normalizeLegacySettings } from "./legacy-settings.ts";
import { execute, snapshot } from "./service.ts";

const id = "11111111-1111-4111-8111-111111111111";
const bank = { id, bank: "Banco A", holder: "Titular A", clabe: "012345678901234567" };
const legacy = {
  name: "Original",
  address: "Calle",
  phone: "123",
  thanks: "Gracias",
  banks: [bank, { ...bank, bank: "Banco B", holder: "Titular B", clabe: "012345678901234568" }],
};
const signal = new AbortController().signal;
let dir: string, db: Db;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ventas-legacy-banks-"));
  db = openVentasDatabase(dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("legacy current bank identities", () => {
  it("retains first identity, account fields and order and avoids all original and generated IDs", () => {
    const initial = normalizeLegacySettings(legacy);
    const candidate = initial.banks[1]?.id;
    if (!candidate) throw Error("Missing normalized bank");
    const input = {
      ...legacy,
      banks: Array.from({ length: 20 }, (_, n) =>
        n === 19 ? { ...bank, id: candidate, bank: "Reserved ID" } : { ...bank, bank: `Bank ${n}` },
      ),
    };
    const normalized = normalizeLegacySettings(input);
    expect(normalized).toEqual(normalizeLegacySettings(input));
    expect(normalized.banks.map(({ bank: name }) => name)).toEqual(input.banks.map((b) => b.bank));
    expect(new Set(normalized.banks.map((b) => b.id)).size).toBe(20);
    expect(normalized.banks[0]).toEqual({ ...input.banks[0], alias: "" });
    expect(normalized.banks[19]).toEqual({ ...input.banks[19], alias: "" });
    for (const entry of normalized.banks.slice(1, 19)) {
      expect(entry.id).not.toBe(candidate);
      expect(entry.originalId).toBe(id);
      expect(entry).toMatchObject({ holder: bank.holder, clabe: bank.clabe, alias: "" });
    }
    expect(normalized.defaultBankId).toBe(id);
    expect(normalizeLegacySettings({ ...legacy, banks: [] }).defaultBankId).toBeNull();
    expect(currentSettingsSchema.parse(normalized)).toEqual(normalized);
  });

  it("migrates only current settings and preserves history and old retries across restart and restore", () => {
    const key = randomUUID();
    const original = execute(
      db,
      {
        key,
        revision: 0,
        action: { type: "saveSettings", settings: { ...legacy, banks: [bank] } },
      },
      signal,
    );
    const action = { type: "saveSettings", settings: legacy } as const;
    db.run("UPDATE operations SET fingerprint=? WHERE key=?", JSON.stringify(action), key);
    const client = execute(
      db,
      {
        key: randomUUID(),
        revision: snapshot(db).revision,
        action: {
          type: "saveClient",
          client: { name: "Historical", phone: "", term: 9, limit: null },
        },
      },
      signal,
    );
    if (client.kind !== "ok") throw Error("Missing client");
    execute(
      db,
      {
        key: randomUUID(),
        revision: snapshot(db).revision,
        action: {
          type: "openingBalance",
          clientId: client.value.id,
          amount: 100,
          due: "2026-01-01",
          note: "Old",
        },
      },
      signal,
    );
    db.run("UPDATE sales SET business=?", JSON.stringify(legacy));
    db.run("UPDATE settings SET data=? WHERE id=1", JSON.stringify(legacy));
    db.run("DELETE FROM schema_migrations WHERE version=6");
    const before = readDataset(db).data;
    db.close();
    db = openVentasDatabase(dir);
    const migrated = snapshot(db);
    expect(migrated.settings).toEqual(normalizeLegacySettings(legacy));
    expect(migrated.settings.banks[1]).toMatchObject({
      ...legacy.banks[1],
      id: expect.not.stringMatching(/^11111111-/),
      originalId: id,
    });
    for (const [table, rows] of Object.entries(before))
      if (table !== "settings")
        expect(readDataset(db).data[table as keyof typeof before]).toEqual(rows);
    expect(execute(db, { key, revision: 0, action }, signal)).toEqual(original);
    expect(snapshot(db).revision).toBe(migrated.revision);
    db.close();
    db = openVentasDatabase(dir);
    expect(snapshot(db)).toEqual(migrated);
    const oldBackup = { ...readDataset(db), modelVersion: 5 as const };
    const currentRow = oldBackup.data.settings[0];
    if (!currentRow) throw Error("Missing settings");
    currentRow.data = JSON.stringify(legacy);
    const restored = validateBackup(oldBackup, signal);
    expect(JSON.parse(String(restored.data.settings[0]?.data))).toEqual(migrated.settings);
    for (const [table, rows] of Object.entries(before))
      if (table !== "settings") expect(restored.data[table as keyof typeof before]).toEqual(rows);
    db.transaction(() => replaceDataset(db, restored.data));
    expect(execute(db, { key, revision: 0, action }, signal)).toEqual(original);
    expect(validateBackup(readDataset(db), signal).data).toEqual(restored.data);
    const settings = { ...snapshot(db).settings, name: "Edited current" };
    execute(
      db,
      {
        key: randomUUID(),
        revision: snapshot(db).revision,
        action: { type: "saveSettings", settings },
      },
      signal,
    );
    expect(snapshot(db).settings.banks).toEqual(migrated.settings.banks);
    expect(db.all("PRAGMA foreign_key_check")).toEqual([]);
  });

  it("rejects duplicate IDs in new commands and explicit model6 without repairing modern corruption", () => {
    expect(() =>
      execute(
        db,
        { key: randomUUID(), revision: 0, action: { type: "saveSettings", settings: legacy } },
        signal,
      ),
    ).toThrow("Invalid settings references");
    const backup = readDataset(db),
      row = backup.data.settings[0];
    if (!row) throw Error("Missing settings");
    row.data = JSON.stringify({
      ...normalizeSettings({ ...legacy, banks: [] }),
      banks: legacy.banks.map((b) => ({ ...b, alias: "" })),
      defaultBankId: id,
    });
    const before = readDataset(db).data;
    expect(() => validateBackup(backup, signal)).toThrow("E_BACKUP_REFS");
    expect(readDataset(db).data).toEqual(before);
    db.run("UPDATE settings SET data=? WHERE id=1", String(row.data));
    db.close();
    db = openVentasDatabase(dir);
    expect(db.get<{ data: string }>("SELECT data FROM settings WHERE id=1")?.data).toBe(row.data);
    expect(() => currentSettingsSchema.parse(snapshot(db).settings)).toThrow();
  });
});
