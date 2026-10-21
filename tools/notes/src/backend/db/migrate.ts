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
      if (item.version === 2) {
        for (const row of database.all<{ id: string; title: string; body_md: string }>(
          "SELECT id, title, body_md FROM notes",
        )) {
          const lines = row.body_md.match(/[^\n]*\n|[^\n]+$/g) ?? [];
          const first = lines.findIndex((line) => line.trim() !== "");
          const heading = lines[first]?.replace(/\r?\n$/, "").match(/^ {0,3}#[ \t]+(.*)$/);
          if (!heading || heading[1]?.replace(/[ \t]+#+[ \t]*$/, "").trim() !== row.title) continue;
          let count = 1;
          if (lines[first + 1]?.trim() === "") count++;
          lines.splice(first, count);
          database.run("UPDATE notes SET body_md = ? WHERE id = ?", lines.join(""), row.id);
        }
      }
      database.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        item.version,
        item.name,
        new Date().toISOString(),
      );
    });
  }
}
