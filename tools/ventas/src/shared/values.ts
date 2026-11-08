import { z } from "zod";

export const money = z.number().int().min(0).max(9_000_000_000_000);
export const quantity = z.number().int().min(0).max(1_000_000_000);
export const entityName = z.string().trim().min(1).max(120);
export const uuid = z.uuid();
export const settingsSchema = z.strictObject({
  name: z.string().trim().max(120),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(40),
  thanks: z.string().trim().max(300),
  banks: z
    .array(
      z.strictObject({
        id: uuid,
        bank: entityName,
        holder: entityName,
        clabe: z.string().regex(/^\d{18}$/),
      }),
    )
    .max(20),
});
export type Settings = z.infer<typeof settingsSchema>;
