import type { Db } from "./driver.ts";

const sources = import.meta.glob<string>("./migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});
export function migrate(db: Db): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  for (const [path, sql] of Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))) {
    const match = /\/(\d+)_([^/]+)\.sql$/.exec(path);
    if (!match) throw new Error("Invalid migration name");
    const version = Number(match[1]);
    db.transaction(() => {
      if (db.get("SELECT version FROM schema_migrations WHERE version = ?", version)) return;
      db.exec(sql);
      db.run(
        "INSERT INTO schema_migrations VALUES (?, ?, ?)",
        version,
        match[2] ?? "",
        new Date().toISOString(),
      );
    });
  }
}
