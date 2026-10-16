import { LensError } from "@lensdesk/sdk/errors";
import { z } from "zod";
import type { SqliteDatabase } from "./database.ts";

export const settingSchemas = {
  locale: z.enum(["es", "en"]),
  theme: z.enum(["system", "dark", "light"]),
  developerMode: z.boolean(),
  "updates.check": z.boolean(),
  "updates.lastCheckedAt": z.string().datetime().nullable(),
  "updates.dismissedVersion": z.string().min(1).max(64).nullable(),
  "window.bounds": z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .strict()
    .nullable(),
};

export type SettingKey = keyof typeof settingSchemas;
const defaults: { [K in SettingKey]: z.infer<(typeof settingSchemas)[K]> } = {
  locale: "es",
  theme: "system",
  developerMode: false,
  "updates.check": true,
  "updates.lastCheckedAt": null,
  "updates.dismissedVersion": null,
  "window.bounds": null,
};

export function getSetting<K extends SettingKey>(
  database: SqliteDatabase,
  key: K,
): (typeof defaults)[K] {
  const row = database.prepare("SELECT value_json FROM settings WHERE key = ?").get(key) as
    | { value_json: string }
    | undefined;
  if (!row) return defaults[key];
  const result = settingSchemas[key].safeParse(JSON.parse(row.value_json));
  if (!result.success)
    throw new LensError("E_INVALID_PARAMS", `El ajuste ${key} almacenado no es válido.`);
  return result.data as (typeof defaults)[K];
}

export function setSetting<K extends SettingKey>(
  database: SqliteDatabase,
  key: K,
  value: unknown,
): void {
  const result = settingSchemas[key].safeParse(value);
  if (!result.success)
    throw new LensError("E_INVALID_PARAMS", `El valor del ajuste ${key} no es válido.`);
  database
    .prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
    )
    .run(key, JSON.stringify(result.data), new Date().toISOString());
}
