import { type Dataset, type NativeBackup, tables } from "../shared/backup-contracts.ts";
import type { Db } from "./db/driver.ts";
import { DomainFault } from "./domain.ts";
export function readDataset(db: Db): NativeBackup {
  return db.transaction(() => {
    const meta = db.all<{ id: number; revision: number }>("SELECT id,revision FROM meta");
    if (
      meta.length !== 1 ||
      meta[0]?.id !== 1 ||
      !Number.isSafeInteger(meta[0].revision) ||
      meta[0].revision < 0
    )
      throw new DomainFault("E_BACKUP_REFS");
    return {
      format: "lensdesk-ventas-native-backup",
      version: 1,
      modelVersion: 7,
      createdAt: new Date().toISOString(),
      toolVersion: "0.1.0",
      revision: meta[0].revision,
      data: Object.fromEntries(
        tables.map((t) => [t, db.all(`SELECT * FROM ${t} ORDER BY rowid`)]),
      ) as Dataset,
    };
  });
}
export function replaceDataset(db: Db, data: Dataset): void {
  db.exec("PRAGMA defer_foreign_keys=ON");
  for (const t of [...tables].reverse()) db.run(`DELETE FROM ${t}`);
  for (const t of tables) {
    const columns = db.all<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name),
      expected = [...columns].sort().join(",");
    for (const row of data[t]) {
      if (Object.keys(row).sort().join(",") !== expected) throw new DomainFault("E_BACKUP_FORMAT");
      db.run(
        `INSERT INTO ${t}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
        ...columns.map((c) => row[c] ?? null),
      );
    }
  }
}
