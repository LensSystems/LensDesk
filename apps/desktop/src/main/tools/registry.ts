import type { SqliteDatabase } from "../db/database.ts";

export type InstalledTool = {
  id: string;
  version: string;
  manifest: Record<string, unknown>;
  installPath: string;
  enabled: boolean;
  signed: boolean;
  keyId: string | null;
  installedAt: string;
  updatedAt: string;
};
type Row = {
  id: string;
  version: string;
  manifest_json: string;
  install_path: string;
  enabled: number;
  signed: number;
  key_id: string | null;
  installed_at: string;
  updated_at: string;
};
function fromRow(row: Row): InstalledTool {
  return {
    id: row.id,
    version: row.version,
    manifest: JSON.parse(row.manifest_json) as Record<string, unknown>,
    installPath: row.install_path,
    enabled: row.enabled === 1,
    signed: row.signed === 1,
    keyId: row.signed === 1 ? row.key_id : null,
    installedAt: row.installed_at,
    updatedAt: row.updated_at,
  };
}
export function createToolRegistry(database: SqliteDatabase) {
  return {
    list(): InstalledTool[] {
      return (database.prepare("SELECT * FROM installed_tools ORDER BY id").all() as Row[]).map(
        fromRow,
      );
    },
    get(id: string): InstalledTool | undefined {
      const row = database.prepare("SELECT * FROM installed_tools WHERE id = ?").get(id) as
        | Row
        | undefined;
      return row ? fromRow(row) : undefined;
    },
    upsert(tool: InstalledTool): void {
      database
        .prepare(
          "INSERT INTO installed_tools (id, version, manifest_json, install_path, enabled, signed, key_id, installed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET version=excluded.version, manifest_json=excluded.manifest_json, install_path=excluded.install_path, signed=excluded.signed, key_id=excluded.key_id, updated_at=excluded.updated_at",
        )
        .run(
          tool.id,
          tool.version,
          JSON.stringify(tool.manifest),
          tool.installPath,
          Number(tool.enabled),
          Number(tool.signed),
          tool.signed ? tool.keyId : null,
          tool.installedAt,
          tool.updatedAt,
        );
    },
    setEnabled(id: string, enabled: boolean, now: string): boolean {
      return (
        Number(
          (
            database
              .prepare("UPDATE installed_tools SET enabled = ?, updated_at = ? WHERE id = ?")
              .run(Number(enabled), now, id) as { changes: number }
          ).changes,
        ) > 0
      );
    },
    remove(id: string): void {
      database.prepare("DELETE FROM installed_tools WHERE id = ?").run(id);
    },
  };
}
