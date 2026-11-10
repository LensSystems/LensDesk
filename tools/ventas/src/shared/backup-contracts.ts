import { z } from "zod";
import { uuid } from "./values.ts";
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export const tables = [
  "settings",
  "products",
  "recipes",
  "clients",
  "cash_sessions",
  "sales",
  "payments",
  "payment_allocations",
  "returns",
  "return_lines",
  "payment_reversals",
  "movements",
  "purchases",
  "outflows",
  "draft",
  "draft_lines",
  "sequences",
  "operations",
  "import_archives",
  "origins",
  "inventory_bases",
  "restore_history",
] as const;
const scalar = z.union([z.string().max(MAX_BACKUP_BYTES), z.number().int().safe(), z.null()]);
export const datasetSchema = z.strictObject(
  Object.fromEntries(
    tables.map((t) => [t, z.array(z.record(z.string(), scalar)).max(100_000)]),
  ) as Record<(typeof tables)[number], z.ZodArray<z.ZodRecord<z.ZodString, typeof scalar>>>,
);
export type Dataset = z.infer<typeof datasetSchema>;
export const nativeBackupSchema = z.strictObject({
  format: z.literal("lensdesk-ventas-native-backup"),
  version: z.literal(1),
  modelVersion: z.union([z.literal(5), z.literal(6), z.literal(7)]),
  createdAt: z.iso.datetime(),
  toolVersion: z.literal("0.1.0"),
  revision: z.number().int().nonnegative().safe(),
  data: datasetSchema,
});
export type NativeBackup = z.infer<typeof nativeBackupSchema>;
export const preparedSchema = z.strictObject({
  id: uuid,
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int().nonnegative().safe(),
  name: z.string().max(255),
  format: z.enum(["native", "web1"]),
  createdAt: z.iso.datetime(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  balance: z.string().regex(/^\d+$/),
  stockValue: z.string().regex(/^\d+$/),
  limitations: z.array(z.string().max(120)).max(30),
});
export type PreparedBackup = z.infer<typeof preparedSchema>;
export const restoreInputSchema = z.strictObject({
  id: uuid,
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  key: uuid,
  revision: z.number().int().nonnegative().safe(),
});
export type RestoreInput = z.infer<typeof restoreInputSchema>;
export const backupInfoSchema = z.strictObject({
  previous: z.boolean(),
  lastRestore: z.iso.datetime().nullable(),
});
