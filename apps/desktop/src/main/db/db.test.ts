import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openHostDatabase } from "./driver.ts";
import { migrate, SchemaTooNewError } from "./migrate.ts";
import { getSetting, setSetting } from "./settings-repo.ts";

const directories: string[] = [];
function open() {
  const directory = mkdtempSync(join(tmpdir(), "lensdesk-db-"));
  directories.push(directory);
  return openHostDatabase(directory);
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("host database", () => {
  it("opens with WAL and foreign keys and applies migrations idempotently", () => {
    const database = open();
    expect(database.prepare("PRAGMA journal_mode").get()).toMatchObject({ journal_mode: "wal" });
    expect(database.prepare("PRAGMA foreign_keys").get()).toMatchObject({ foreign_keys: 1 });
    const before = database
      .prepare("SELECT version, name, applied_at FROM schema_migrations")
      .all();
    migrate(database);
    expect(
      database.prepare("SELECT version, name, applied_at FROM schema_migrations").all(),
    ).toEqual(before);
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "schema_migrations",
        "settings",
        "installed_tools",
        "open_tabs",
        "tool_kv",
      ]),
    );
    database.close();
  });

  it("rejects a newer schema without changing its migration record", () => {
    const database = open();
    database
      .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
      .run(2, "future", "now");
    const before = database.prepare("SELECT * FROM schema_migrations ORDER BY version").all();
    expect(() => migrate(database)).toThrow(SchemaTooNewError);
    expect(database.prepare("SELECT * FROM schema_migrations ORDER BY version").all()).toEqual(
      before,
    );
    database.close();
  });

  it("returns defaults and validates writes", () => {
    const database = open();
    expect(getSetting(database, "locale")).toBe("es");
    expect(getSetting(database, "theme")).toBe("system");
    expect(getSetting(database, "developerMode")).toBe(false);
    expect(getSetting(database, "updates.check")).toBe(true);
    setSetting(database, "locale", "en");
    expect(getSetting(database, "locale")).toBe("en");
    expect(() => setSetting(database, "locale", "fr")).toThrowError(
      expect.objectContaining({ code: "E_INVALID_PARAMS" }),
    );
    expect(getSetting(database, "updates.dismissedVersion")).toBeNull();
    setSetting(database, "updates.dismissedVersion", "2.0.0");
    expect(getSetting(database, "updates.dismissedVersion")).toBe("2.0.0");
    setSetting(database, "updates.dismissedVersion", null);
    expect(getSetting(database, "updates.dismissedVersion")).toBeNull();
    expect(() => setSetting(database, "updates.dismissedVersion", 3)).toThrowError(
      expect.objectContaining({ code: "E_INVALID_PARAMS" }),
    );
    database.close();
  });
});
