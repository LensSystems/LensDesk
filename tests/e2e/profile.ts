import { lstat, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setSetting } from "../../apps/desktop/src/main/db/settings-repo.ts";

// Real persisted settings avoid a startup request racing synthetic update events.
// Updates remain enabled; the normal throttle skips the automatic startup check.
export async function prepareRecentUpdateProfile(profile: string): Promise<void> {
  const file = join(profile, "lensdesk.db");
  try {
    await lstat(file);
    // Existing profiles belong to their scenario, including custom/future schemas.
    return;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  const database = new DatabaseSync(file);
  try {
    database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    database.exec(
      "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
    );
    const directory = resolve(import.meta.dirname, "../../apps/desktop/src/main/db/migrations");
    const migrations = (await readdir(directory))
      .flatMap((file) => {
        const match = /^(\d+)_(.+)\.sql$/.exec(file);
        const name = match?.[2];
        return match && name ? [{ file, version: Number(match[1]), name }] : [];
      })
      .sort((left, right) => left.version - right.version);
    for (const migration of migrations) {
      const sql = await readFile(join(directory, migration.file), "utf8");
      database.exec("BEGIN");
      try {
        database.exec(sql);
        database
          .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
          .run(migration.version, migration.name, new Date().toISOString());
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
    setSetting(database, "updates.check", true);
    setSetting(database, "updates.lastCheckedAt", new Date().toISOString());
  } finally {
    database.close();
  }
}
