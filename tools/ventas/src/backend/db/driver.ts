import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "./migrate.ts";

export type Db = {
  exec(sql: string): void;
  run(sql: string, ...values: (string | number | null)[]): void;
  get<T>(sql: string, ...values: (string | number | null)[]): T | undefined;
  all<T>(sql: string, ...values: (string | number | null)[]): T[];
  transaction<T>(work: () => T): T;
  close(): void;
};
export function openVentasDatabase(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });
  return createDatabase(join(dataDir, "ventas.db"));
}
export function memoryDatabase(): Db {
  return createDatabase(":memory:");
}
function createDatabase(path: string): Db {
  const database = new DatabaseSync(path);
  database.function("ventas_fold", { deterministic: true }, (value) =>
    String(value ?? "")
      .normalize("NFKC")
      .toLowerCase(),
  );
  database.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000; PRAGMA temp_store=MEMORY;",
  );
  const db: Db = {
    exec: (sql) => database.exec(sql),
    run: (sql, ...values) => {
      database.prepare(sql).run(...values);
    },
    get: <T>(sql: string, ...values: (string | number | null)[]) =>
      database.prepare(sql).get(...values) as T | undefined,
    all: <T>(sql: string, ...values: (string | number | null)[]) =>
      database.prepare(sql).all(...values) as T[],
    transaction: <T>(work: () => T) => {
      database.exec("BEGIN IMMEDIATE");
      try {
        const value = work();
        database.exec("COMMIT");
        return value;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    close: () => database.close(),
  };
  try {
    migrate(db);
  } catch (error) {
    database.close();
    throw error;
  }
  return db;
}
