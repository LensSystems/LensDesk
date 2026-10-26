import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "./migrate.ts";

export type Db = {
  exec(sql: string): void;
  run(sql: string, ...params: (string | number | null)[]): void;
  get<T>(sql: string, ...params: (string | number | null)[]): T | undefined;
  all<T>(sql: string, ...params: (string | number | null)[]): T[];
  transaction<T>(work: () => T): T;
  close(): void;
};

export function openNotesDatabase(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });
  const database = new DatabaseSync(join(dataDir, "notes.db"));
  // secure_delete: lo borrado se sobrescribe con ceros, para que no queden restos de notas privadas.
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;");
  const db: Db = {
    exec: (sql) => database.exec(sql),
    run: (sql, ...params) => {
      database.prepare(sql).run(...params);
    },
    get: <T>(sql: string, ...params: (string | number | null)[]) =>
      database.prepare(sql).get(...params) as T | undefined,
    all: <T>(sql: string, ...params: (string | number | null)[]) =>
      database.prepare(sql).all(...params) as T[],
    transaction: <T>(work: () => T) => {
      database.exec("BEGIN");
      try {
        const result = work();
        database.exec("COMMIT");
        return result;
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
