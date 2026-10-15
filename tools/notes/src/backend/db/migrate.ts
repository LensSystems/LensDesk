import type { Db } from "./driver.ts";

const migrations = import.meta.glob<string>("./migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

export function migrate(database: Db): void {
  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  const known = Object.entries(migrations)
    .map(([file, sql]) => {
      const match = /\/(\d+)_([^/]+)\.sql$/.exec(file);
      return match ? { version: Number(match[1]), name: match[2] ?? "", sql } : undefined;
    })
    .filter((item): item is { version: number; name: string; sql: string } => item !== undefined)
    .sort((a, b) => a.version - b.version);
  const applied = new Set(
    database
      .all<{ version: number }>("SELECT version FROM schema_migrations")
      .map((row) => row.version),
  );
  for (const item of known) {
    if (applied.has(item.version)) continue;
    database.transaction(() => {
      database.exec(item.sql);
      database.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        item.version,
        item.name,
        new Date().toISOString(),
      );
    });
  }
}
