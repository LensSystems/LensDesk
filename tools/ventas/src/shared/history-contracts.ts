import { z } from "zod";
import { returnLineSchema, returnSchema, reversalSchema } from "./corrections-contracts.ts";
import {
  accountSchema,
  clientSchema,
  closingSchema,
  outflowSchema,
  paymentSchema,
  saleBalanceSchema,
  saleSchema,
} from "./trading-contracts.ts";
import { money, settingsSchema, uuid } from "./values.ts";
export const accountSummarySchema = accountSchema.omit({ purchases: true });
const pageFields = {
  offset: z.number().int().min(0).max(10_000_000).default(0),
  limit: z.number().int().min(1).max(50).default(20),
  revision: z.number().int().nonnegative().optional(),
};
export const historyParamsSchema = z.strictObject({
  ...pageFields,
  kind: z.enum(["sales", "payments", "returns", "inventory", "outflows", "purchases", "closings"]),
  clientId: uuid.optional(),
  excludeOpening: z.boolean().optional(),
  saleId: uuid.optional(),
  query: z.string().trim().max(120).default(""),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export const saleSummarySchema = z.strictObject({
  legacyFolio: z.string().max(200).optional(),
  id: uuid,
  folio: z.number().int().positive(),
  clientId: uuid.nullable(),
  clientName: z.string(),
  date: z.iso.date(),
  due: z.iso.date(),
  total: money,
  net: money,
  paid: money,
  pending: money,
  opening: z.boolean(),
  note: z.string(),
});
export const paymentSummarySchema = paymentSchema
  .omit({ allocations: true })
  .extend({ reversal: reversalSchema.nullable(), applied: money.nullable() });
export const returnSummarySchema = returnSchema.omit({ lines: true });
export const historyRowSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("sale"), data: saleSummarySchema }),
  z.strictObject({ kind: z.literal("payment"), data: paymentSummarySchema }),
  z.strictObject({ kind: z.literal("return"), data: returnSummarySchema }),
  z.strictObject({ kind: z.literal("outflow"), data: outflowSchema }),
  z.strictObject({ kind: z.literal("closing"), data: closingSchema }),
  z.strictObject({
    kind: z.literal("inventory"),
    data: z.strictObject({
      id: uuid,
      productId: uuid,
      productName: z.string(),
      qty: z.number().int(),
      value: z.number().int(),
      kind: z.string(),
      referenceId: uuid,
      reason: z.string(),
      at: z.iso.datetime(),
      date: z.iso.date(),
    }),
  }),
  z.strictObject({
    kind: z.literal("purchase"),
    data: z.strictObject({
      id: uuid,
      productId: uuid,
      productName: z.string(),
      qty: z.number().int().positive(),
      cost: money,
      method: z.enum(["cash", "transfer"]),
      bankId: uuid.nullable(),
      bankSnapshot: settingsSchema.shape.banks.element.nullable(),
      cashId: uuid.nullable(),
      at: z.iso.datetime(),
      date: z.iso.date(),
    }),
  }),
]);
export const historyPageSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
  rows: z.array(historyRowSchema).max(50),
});
export const returnDetailParamsSchema = z.strictObject({
  ...pageFields,
  returnId: uuid,
});
export const returnDetailSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  record: returnSummarySchema,
  saleFolio: z.number().int().positive(),
  saleLegacyFolio: z.string().max(200).optional(),
  lines: z.strictObject({
    total: z.number().int().nonnegative(),
    nextOffset: z.number().int().nonnegative().nullable(),
    rows: z.array(returnLineSchema.extend({ name: z.string(), price: money })).max(50),
  }),
});
export const saleDetailParamsSchema = z.strictObject({
  saleId: uuid,
  revision: z.number().int().nonnegative().optional(),
  paymentOffset: pageFields.offset,
  returnOffset: pageFields.offset,
});
export const saleDetailSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  sale: saleSchema,
  balance: saleBalanceSchema,
  initialPayment: paymentSchema.nullable(),
  returned: z
    .array(z.strictObject({ lineId: uuid, qty: z.number().int().nonnegative() }))
    .max(1000),
  payments: historyPageSchema,
  returns: historyPageSchema,
});
export const statementParamsSchema = z.strictObject({
  clientId: uuid,
  bankId: uuid.nullable().default(null),
  revision: z.number().int().nonnegative().optional(),
  salesOffset: pageFields.offset,
  paymentOffset: pageFields.offset,
  returnOffset: pageFields.offset,
});
export const statementSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  client: clientSchema,
  business: settingsSchema,
  bankSnapshot: settingsSchema.shape.banks.element.nullable(),
  account: accountSummarySchema,
  today: z.iso.date(),
  salesPage: historyPageSchema,
  sales: z.array(saleSchema).max(10),
  payments: historyPageSchema,
  returns: historyPageSchema,
});
export const summaryParamsSchema = z.strictObject({ from: z.iso.date(), to: z.iso.date() });
const signed = z.number().int().min(-9_000_000_000_000).max(9_000_000_000_000);
export const summarySchema = z.strictObject({
  from: z.iso.date(),
  to: z.iso.date(),
  revenue: signed,
  cogs: signed,
  expenses: money,
  loss: money,
  profit: signed,
  received: signed,
  cash: signed,
  transfer: signed,
  purchases: money,
  withdrawals: money,
  balance: money,
  overdue: money,
  count: z.number().int().nonnegative(),
  top: z
    .array(
      z.strictObject({ productId: uuid, name: z.string(), qty: z.number().int().nonnegative() }),
    )
    .max(6),
});
export type HistoryParams = z.infer<typeof historyParamsSchema>;
export type HistoryPage = z.infer<typeof historyPageSchema>;
export type HistoryRow = z.infer<typeof historyRowSchema>;
export type SaleDetail = z.infer<typeof saleDetailSchema>;
export type Statement = z.infer<typeof statementSchema>;
export type Summary = z.infer<typeof summarySchema>;

export type ReturnDetail = z.infer<typeof returnDetailSchema>;
