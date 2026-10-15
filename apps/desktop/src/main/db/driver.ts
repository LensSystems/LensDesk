import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "./migrate.ts";

export function openHostDatabase(userData: string): DatabaseSync {
  mkdirSync(userData, { recursive: true });
  const database = new DatabaseSync(join(userData, "lensdesk.db"));
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  try {
    migrate(database);
  } catch (error) {
    database.close();
    throw error;
  }
  return database;
}

export function readStoredLocale(userData: string): "es" | "en" {
  const database = new DatabaseSync(join(userData, "lensdesk.db"), { readOnly: true });
  try {
    const table = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'")
      .get();
    if (!table) return "es";
    const row = database.prepare("SELECT value_json FROM settings WHERE key = ?").get("locale") as
      | { value_json: string }
      | undefined;
    return row && JSON.parse(row.value_json) === "en" ? "en" : "es";
  } catch {
    return "es";
  } finally {
    database.close();
  }
}

export function supportsFts5(): boolean {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE VIRTUAL TABLE smoke_fts USING fts5(content)");
    database.prepare("INSERT INTO smoke_fts (content) VALUES (?)").run("lensdesk smoke");
    return (
      database.prepare("SELECT content FROM smoke_fts WHERE smoke_fts MATCH ?").get("lensdesk") !==
      undefined
    );
  } finally {
    database.close();
  }
}
