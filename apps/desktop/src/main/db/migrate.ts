import type { SqliteDatabase } from "./database.ts";

export class SchemaTooNewError extends Error {
  readonly version: number;
  readonly latest: number;

  constructor(version: number, latest: number) {
    super(`La base usa el esquema ${version}, pero esta versión solo admite hasta ${latest}.`);
    this.name = "SchemaTooNewError";
    this.version = version;
    this.latest = latest;
  }
}

const migrations = import.meta.glob<string>("./migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

export function migrate(database: SqliteDatabase): void {
  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  const known = Object.entries(migrations)
    .map(([file, sql]) => {
      const match = /\/(\d+)_([^/]+)\.sql$/.exec(file);
      const name = match?.[2];
      return match && name ? { version: Number(match[1]), name, sql } : undefined;
    })
    .filter(
      (migration): migration is { version: number; name: string; sql: string } =>
        migration !== undefined,
    )
    .sort((left, right) => left.version - right.version);
  const latest = known.at(-1)?.version ?? 0;
  const rows = database
    .prepare("SELECT version FROM schema_migrations ORDER BY version DESC")
    .all() as { version: number }[];
  const applied = new Set(rows.map((row) => row.version));
  const newestApplied = rows[0]?.version ?? 0;
  if (newestApplied > latest) throw new SchemaTooNewError(newestApplied, latest);

  for (const migration of known) {
    if (applied.has(migration.version)) continue;
    database.exec("BEGIN");
    try {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
        .run(migration.version, migration.name, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
