import { z } from "zod";
import { money, quantity, settingsSchema, uuid } from "./values.ts";

const refundInput = z.strictObject({
  method: z.enum(["cash", "transfer"]),
  bankId: uuid.nullable(),
  reference: z.string().trim().max(200),
});
export const correctionActionSchemas = [
  z.strictObject({
    type: z.literal("returnSale"),
    saleId: uuid,
    items: z
      .array(z.strictObject({ lineId: uuid, qty: quantity.refine((n) => n > 0) }))
      .min(1)
      .max(1000),
    restock: z.boolean(),
    reason: z.string().trim().min(1).max(500),
    refund: refundInput,
  }),
  z.strictObject({
    type: z.literal("reversePayment"),
    paymentId: uuid,
    reason: z.string().trim().min(1).max(500),
  }),
] as const;
export const returnLineSchema = z.strictObject({
  id: uuid,
  returnId: uuid,
  lineId: uuid,
  productId: uuid,
  qty: quantity.refine((n) => n > 0),
  amount: money,
  cost: money,
});
export const returnSchema = z.strictObject({
  legacyFolio: z.string().max(200).optional(),
  id: uuid,
  folio: z.number().int().positive(),
  saleId: uuid,
  reason: z.string(),
  restock: z.boolean(),
  amount: money,
  cost: money,
  refund: money,
  method: z.enum(["cash", "transfer"]).nullable(),
  bankId: uuid.nullable(),
  bankSnapshot: settingsSchema.shape.banks.element.nullable(),
  reference: z.string(),
  cashId: uuid.nullable(),
  at: z.iso.datetime(),
  date: z.iso.date(),
  lines: z.array(returnLineSchema),
});
export const reversalSchema = z.strictObject({
  legacyFolio: z.string().max(200).optional(),
  id: uuid,
  folio: z.number().int().positive(),
  paymentId: uuid,
  reason: z.string(),
  amount: money,
  method: z.enum(["cash", "transfer"]),
  bankId: uuid.nullable(),
  bankSnapshot: settingsSchema.shape.banks.element.nullable(),
  reference: z.string(),
  cashId: uuid.nullable(),
  at: z.iso.datetime(),
  date: z.iso.date(),
});
export type ReturnRecord = z.infer<typeof returnSchema>;
export type ReversalRecord = z.infer<typeof reversalSchema>;
