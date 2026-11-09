import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
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
  const statements = new Map<string, StatementSync>();
  const prepare = (sql: string) => {
    let statement = statements.get(sql);
    if (statement) statements.delete(sql);
    else statement = database.prepare(sql);
    statements.set(sql, statement);
    if (statements.size > 128) {
      const first = statements.keys().next().value;
      if (first !== undefined) statements.delete(first);
    }
    return statement;
  };
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
      prepare(sql).run(...values);
    },
    get: <T>(sql: string, ...values: (string | number | null)[]) =>
      prepare(sql).get(...values) as T | undefined,
    all: <T>(sql: string, ...values: (string | number | null)[]) =>
      prepare(sql).all(...values) as T[],
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
    close: () => {
      statements.clear();
      database.close();
    },
  };
  try {
    migrate(db);
  } catch (error) {
    database.close();
    throw error;
  }
  return db;
}
