import type { Db } from "./db/driver.ts";
export function historical(
  db: Db,
  entity: string,
  id: string,
): { legacyFolio?: string; historyMissing?: string[] } {
  const row = db.get<{ legacyFolio: string | null; missing: string }>(
    "SELECT legacyFolio,missing FROM origins WHERE entity=? AND id=?",
    entity,
    id,
  );
  return row
    ? {
        ...(row.legacyFolio ? { legacyFolio: row.legacyFolio } : {}),
        ...(entity === "sales" ? { historyMissing: JSON.parse(row.missing) as string[] } : {}),
      }
    : {};
}
