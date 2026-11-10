import { z } from "zod";

export const money = z.number().int().min(0).max(9_000_000_000_000);
export const quantity = z.number().int().min(0).max(1_000_000_000);
export const entityName = z.string().trim().min(1).max(120);
export const uuid = z.uuid();
export const settingsInputSchema = z.strictObject({
  name: z.string().trim().max(120),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(40),
  thanks: z.string().trim().max(300),
  banks: z
    .array(
      z.strictObject({
        id: uuid,
        originalId: uuid.optional(),
        bank: entityName,
        holder: entityName,
        clabe: z.string().regex(/^\d{18}$/),
        alias: z.string().trim().max(120).optional(),
      }),
    )
    .max(20),
  ownerName: z.string().trim().max(120).optional(),
  rfc: z.string().trim().max(40).optional(),
  cashier: z.string().trim().max(120).optional(),
  defaultTerm: z.number().int().min(1).max(30).optional(),
  defaultBankId: uuid.nullable().optional(),
});
export const settingsSchema = settingsInputSchema.superRefine((settings, ctx) => {
  const ids = new Set(settings.banks.map((bank) => bank.id));
  if (ids.size !== settings.banks.length)
    ctx.addIssue({ code: "custom", path: ["banks"], message: "Duplicate bank IDs" });
  if (settings.defaultBankId && !ids.has(settings.defaultBankId))
    ctx.addIssue({ code: "custom", path: ["defaultBankId"], message: "Unknown default bank" });
});
export const currentSettingsSchema = settingsSchema.safeExtend({
  ownerName: settingsSchema.shape.ownerName.unwrap(),
  rfc: settingsSchema.shape.rfc.unwrap(),
  cashier: settingsSchema.shape.cashier.unwrap(),
  defaultTerm: settingsSchema.shape.defaultTerm.unwrap(),
  defaultBankId: settingsSchema.shape.defaultBankId.unwrap(),
  banks: settingsSchema.shape.banks.element.required({ alias: true }).array().max(20),
});
export type Settings = z.infer<typeof settingsSchema>;

export function normalizeSettings(input: Settings) {
  const settings = settingsSchema.parse(input);
  return {
    ...settings,
    banks: settings.banks.map((bank) => ({ ...bank, alias: bank.alias ?? "" })),
    ownerName: settings.ownerName ?? "",
    rfc: settings.rfc ?? "",
    cashier: settings.cashier ?? "",
    defaultTerm: settings.defaultTerm ?? 15,
    defaultBankId:
      settings.defaultBankId === undefined
        ? (settings.banks[0]?.id ?? null)
        : settings.defaultBankId,
  };
}
export type CurrentSettings = ReturnType<typeof normalizeSettings>;
export const defaultBank = (settings: Settings) =>
  settings.defaultBankId === undefined ? (settings.banks[0]?.id ?? null) : settings.defaultBankId;
export const bankLabel = (bank: Settings["banks"][number]) =>
  bank.alias || `${bank.bank} · ${bank.holder}`;
