import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  cleanRestoreStage,
  commitRestore,
  installRestoreStage,
  stageRestore,
} from "./backup-commit.ts";
import { readDataset } from "./backup-dataset.ts";
import { openVentasDatabase } from "./db/driver.ts";

it.each(["missing", "extra", "rowid", "scalar", "type"])(
  "rejects a %s mismatch without publishing staged rows or changing SQLite configuration",
  async (difference) => {
    const dir = mkdtempSync(join(tmpdir(), "ventas-stage-equality-")),
      db = openVentasDatabase(dir),
      before = readDataset(db),
      indexes = db.all("SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name"),
      run = db.run;
    db.exec("PRAGMA main.cache_size=-4096");
    try {
      await stageRestore(db, before.data, new AbortController().signal);
      let injected = false;
      db.run = (sql, ...values) => {
        run(sql, ...values);
        if (!injected && sql.startsWith("INSERT INTO main.sequences(")) {
          injected = true;
          if (difference === "missing") run("DELETE FROM main.sequences WHERE name='sale'");
          else if (difference === "extra") run("INSERT INTO main.sequences VALUES('extra',0)");
          else if (difference === "rowid") run("UPDATE main.sequences SET rowid=rowid+100");
          else if (difference === "scalar")
            run("UPDATE main.sequences SET value=7 WHERE name='sale'");
          else run("UPDATE main.settings SET data=CAST(data AS BLOB) WHERE id=1");
        }
      };
      expect(() => commitRestore(db, () => installRestoreStage(db))).toThrowError(
        expect.objectContaining({ issue: { code: "E_BACKUP_REFS" } }),
      );
      expect(injected).toBe(true);
      db.run = run;
      await cleanRestoreStage(db);
      expect(readDataset(db).data).toEqual(before.data);
      expect(
        db.all("SELECT name,sql FROM main.sqlite_schema WHERE type='index' ORDER BY name"),
      ).toEqual(indexes);
      expect(db.get<{ cache_size: number }>("PRAGMA main.cache_size")?.cache_size).toBe(-4096);
      expect(db.get<{ foreign_keys: number }>("PRAGMA foreign_keys")?.foreign_keys).toBe(1);
      expect(db.all("SELECT * FROM restore_receipts")).toHaveLength(0);
      expect(
        db.all("SELECT name FROM sqlite_temp_master WHERE name LIKE 'ventas_restore_%'"),
      ).toHaveLength(0);
      // Reuse the connection after rollback, with identical SQL and recreated TEMP tables.
      await stageRestore(db, before.data, new AbortController().signal);
      commitRestore(db, () => installRestoreStage(db));
      await cleanRestoreStage(db);
      expect(readDataset(db).data).toEqual(before.data);
      expect(db.get<{ cache_size: number }>("PRAGMA main.cache_size")?.cache_size).toBe(-4096);
    } finally {
      db.run = run;
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
