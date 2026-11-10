import { setImmediate } from "node:timers/promises";
import type { Dataset } from "../shared/backup-contracts.ts";
import { tables } from "../shared/backup-contracts.ts";
import { cooperate } from "./backup-cooperation.ts";
import type { Db } from "./db/driver.ts";
import { checkCancelled, DomainFault } from "./domain.ts";

const stage = (table: (typeof tables)[number]) => `temp.ventas_restore_${table}`;
const columns = (db: Db, table: (typeof tables)[number]) =>
  db.all<{ name: string }>(`PRAGMA main.table_info(${table})`).map((c) => c.name);
export function dropRestoreStage(db: Db): void {
  for (const table of [...tables].reverse()) db.run(`DROP TABLE IF EXISTS ${stage(table)}`);
}
export async function cleanRestoreStage(db: Db): Promise<void> {
  for (const table of [...tables].reverse()) {
    db.run(`DROP TABLE IF EXISTS ${stage(table)}`);
    await setImmediate();
  }
}
export function commitRestore<T>(db: Db, work: () => T): T {
  const previous = db.get<{ cache_size: number }>("PRAGMA main.cache_size")?.cache_size;
  if (previous === undefined) throw new DomainFault("E_BACKUP_REFS");
  // The admitted payload can exceed SQLite's default 2 MiB cache. Reserve a
  // bounded working set for bulk copying and index rebuilding, without changing
  // durability, foreign keys or cache-spill behavior. This scope never yields.
  db.exec("PRAGMA main.cache_size=-32768");
  try {
    return db.transaction(work);
  } finally {
    db.exec(`PRAGMA main.cache_size=${previous}`);
  }
}
export async function stageRestore(db: Db, data: Dataset, signal: AbortSignal): Promise<void> {
  try {
    await cooperate(stageSteps(db, data, signal), signal);
  } catch (error) {
    dropRestoreStage(db);
    throw error;
  }
}
function* stageSteps(db: Db, data: Dataset, signal: AbortSignal) {
  dropRestoreStage(db);
  for (const table of tables) {
    checkCancelled(signal);
    const names = columns(db, table),
      list = names.join(",");
    db.run(
      `CREATE TEMP TABLE ventas_restore_${table} AS SELECT ${list} FROM main.${table} WHERE 0`,
    );
    for (let n = 0; n < data[table].length; n += 100) {
      db.transaction(() => {
        for (const row of data[table].slice(n, n + 100))
          db.run(
            `INSERT INTO ${stage(table)}(${list}) VALUES(${names.map(() => "?").join(",")})`,
            ...names.map((name) => row[name] ?? null),
          );
      });
      yield;
    }
    yield;
  }
}
// Every domain/JSON/rational invariant has been checked on this immutable dataset in isolation.
// Exact SQL equality proves that the atomic target is the same validated set, without JS replays.
export function installRestoreStage(db: Db): void {
  db.exec("PRAGMA defer_foreign_keys=ON");
  // Rebuild non-unique lookup indexes in bulk. PK/UNIQUE constraints stay active.
  // DDL is the installed schema, never imported text, and rolls back with the rows.
  const indexes = db
    .all<{ name: string; tbl_name: string; sql: string }>(
      "SELECT name,tbl_name,sql FROM main.sqlite_schema WHERE type='index' AND sql IS NOT NULL",
    )
    .filter(
      (index) =>
        tables.some((table) => table === index.tbl_name) && /^\s*CREATE\s+INDEX\s/i.test(index.sql),
    );
  for (const index of indexes) db.run(`DROP INDEX main."${index.name.replaceAll('"', '""')}"`);
  for (const table of [...tables].reverse()) db.run(`DELETE FROM main.${table}`);
  for (const table of tables) {
    const list = columns(db, table).join(",");
    db.run(`INSERT INTO main.${table}(${list}) SELECT ${list} FROM ${stage(table)} ORDER BY rowid`);
  }
  for (const index of indexes) db.run(index.sql);
  // These tables use ordinary rowids, without AUTOINCREMENT. Empty targets and the
  // ordered insert above preserve staging ordinals; compare every scalar and type.
  // Equal counts and one complete rowid correspondence prove a bijection, so no
  // second scalar/type scan in the opposite direction is needed.
  for (const table of tables) {
    const mismatch = columns(db, table)
      .map(
        (name) =>
          `(m.${name} COLLATE BINARY IS NOT s.${name} COLLATE BINARY OR typeof(m.${name}) != typeof(s.${name}))`,
      )
      .join(" OR ");
    const difference = db.get<{ different: number }>(`SELECT
   (SELECT COUNT(*) FROM main.${table}) != (SELECT COUNT(*) FROM ${stage(table)})
   OR EXISTS(SELECT 1 FROM main.${table} m LEFT JOIN ${stage(table)} s ON m.rowid=s.rowid
     WHERE s.rowid IS NULL OR ${mismatch}) AS different`);
    if (difference?.different !== 0) throw new DomainFault("E_BACKUP_REFS");
  }
  if (db.all("PRAGMA main.foreign_key_check").length) throw new DomainFault("E_BACKUP_REFS");
}
