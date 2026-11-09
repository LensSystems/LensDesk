import { normalizeLegacySettings } from "../legacy-settings.ts";
import { recoverProductIcons } from "../product-presentation.ts";
import type { Db } from "./driver.ts";
import inventoryMigration from "./migrations/001_inventory.sql?raw";
import tradingMigration from "./migrations/002_sales_accounts_cash.sql?raw";
import outflowReferenceMigration from "./migrations/003_outflow_reference.sql?raw";
import correctionsMigration from "./migrations/004_returns_reversals.sql?raw";

import backupMigration from "./migrations/005_backup.sql?raw";

import preferencesMigration from "./migrations/006_settings_preferences.sql?raw";

import presentationMigration from "./migrations/007_product_presentation.sql?raw";

const sources = {
  "./migrations/001_inventory.sql": inventoryMigration,
  "./migrations/002_sales_accounts_cash.sql": tradingMigration,
  "./migrations/003_outflow_reference.sql": outflowReferenceMigration,
  "./migrations/004_returns_reversals.sql": correctionsMigration,
  "./migrations/005_backup.sql": backupMigration,
  "./migrations/006_settings_preferences.sql": preferencesMigration,
  "./migrations/007_product_presentation.sql": presentationMigration,
};
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
      if (version === 6) {
        const row = db.get<{ data: string }>("SELECT data FROM settings WHERE id=1");
        if (row)
          db.run(
            "UPDATE settings SET data=? WHERE id=1",
            JSON.stringify(normalizeLegacySettings(JSON.parse(row.data))),
          );
      }
      db.exec(sql);
      if (version === 7) {
        const data = {
          products: db.all<Record<string, string | number | null>>(
            "SELECT * FROM products ORDER BY rowid",
          ),
          origins: db.all<Record<string, string | number | null>>(
            "SELECT * FROM origins ORDER BY rowid",
          ),
          import_archives: db.all<Record<string, string | number | null>>(
            "SELECT * FROM import_archives ORDER BY rowid",
          ),
        };
        for (const _ of recoverProductIcons(data)) {
          /* Complete the forward migration atomically. */
        }
        for (const product of data.products)
          db.run("UPDATE products SET icon=? WHERE id=?", product.icon ?? null, product.id ?? null);
      }
      db.run(
        "INSERT INTO schema_migrations VALUES (?, ?, ?)",
        version,
        match[2] ?? "",
        new Date().toISOString(),
      );
    });
  }
}
