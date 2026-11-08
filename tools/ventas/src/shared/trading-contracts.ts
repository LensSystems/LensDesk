import { z } from "zod";
import { entityName, money, quantity, settingsSchema, uuid } from "./values.ts";

export const clientInputSchema = z.strictObject({
  id: uuid.optional(),
  name: entityName,
  phone: z.string().trim().max(40),
  term: z.number().int().min(1).max(30),
  limit: money.nullable(),
});
export const clientSchema = clientInputSchema.required().extend({ active: z.boolean() });
export const draftSchema = z.strictObject({
  clientId: uuid.nullable(),
  lines: z.array(z.strictObject({ productId: uuid, qty: quantity.refine((n) => n > 0) })).max(1000),
});
export const paymentInputSchema = z.strictObject({
  amount: money,
  received: money,
  method: z.enum(["cash", "transfer"]),
  bankId: uuid.nullable(),
  reference: z.string().trim().max(200),
});
export const tradingActionSchemas = [
  z.strictObject({ type: z.literal("saveClient"), client: clientInputSchema }),
  z.strictObject({ type: z.literal("setClientActive"), id: uuid, active: z.boolean() }),
  z.strictObject({ type: z.literal("saveDraft"), draft: draftSchema }),
  z.strictObject({
    type: z.literal("sell"),
    expectedTotal: money,
    payment: paymentInputSchema,
    exception: z.string().trim().max(500),
  }),
  z.strictObject({ type: z.literal("payAccount"), clientId: uuid, payment: paymentInputSchema }),
  z.strictObject({
    type: z.literal("openingBalance"),
    clientId: uuid,
    amount: money.refine((n) => n > 0),
    due: z.iso.date(),
    note: z.string().trim().min(1).max(500),
  }),
  z.strictObject({ type: z.literal("openCash"), initial: money }),
  z.strictObject({
    type: z.literal("closeCash"),
    counted: money,
    reason: z.string().trim().max(500),
  }),
  z.strictObject({
    type: z.literal("outflow"),
    kind: z.enum(["expense", "withdrawal"]),
    concept: entityName,
    category: z.string().trim().max(120),
    payment: paymentInputSchema,
  }),
] as const;
export const saleLineSchema = z.strictObject({
  id: uuid,
  productId: uuid,
  name: entityName,
  qty: quantity.refine((n) => n > 0),
  price: money,
  cost: money,
});
export const saleSchema = z.strictObject({
  initialPaymentId: uuid.nullable(),
  id: uuid,
  folio: z.number().int().positive(),
  clientId: uuid.nullable(),
  clientSnapshot: clientSchema.nullable(),
  business: settingsSchema,
  lines: z.array(saleLineSchema).max(1000),
  total: money,
  term: z.number().int().min(0).max(30),
  due: z.iso.date(),
  exception: z.string(),
  opening: z.boolean(),
  note: z.string(),
  received: money,
  change: money,
  at: z.iso.datetime(),
  date: z.iso.date(),
});
export const paymentSchema = z.strictObject({
  opening: z.boolean().default(false),
  reversalId: uuid.nullable(),
  id: uuid,
  folio: z.number().int().positive(),
  clientId: uuid.nullable(),
  amount: money,
  method: z.enum(["cash", "transfer"]),
  bankId: uuid.nullable(),
  bankSnapshot: settingsSchema.shape.banks.element.nullable(),
  reference: z.string(),
  cashId: uuid.nullable(),
  at: z.iso.datetime(),
  date: z.iso.date(),
  allocations: z.array(z.strictObject({ saleId: uuid, amount: money.refine((n) => n > 0) })),
});
export const saleBalanceSchema = z.strictObject({
  saleId: uuid,
  total: money,
  paid: money,
  pending: money,
  due: z.iso.date(),
});
export const accountSchema = z.strictObject({
  clientId: uuid,
  balance: money,
  overdue: money,
  nextDue: z.iso.date().nullable(),
  totalPaid: money,
  purchases: z.array(saleBalanceSchema),
});
const signedMoney = z.number().int().min(-9_000_000_000_000).max(9_000_000_000_000);
export const cashSchema = z.strictObject({
  id: uuid,
  initial: money,
  at: z.iso.datetime(),
  date: z.iso.date(),
  ins: money,
  purchases: money,
  expenses: money,
  withdrawals: money,
  outs: money,
  refunds: money.default(0),
  reversals: money.default(0),
  expected: signedMoney,
});
export const closingSchema = cashSchema.extend({
  counted: money,
  difference: signedMoney,
  reason: z.string(),
  closedAt: z.iso.datetime(),
  closedDate: z.iso.date(),
});
export const outflowSchema = z.strictObject({
  reference: z.string().max(200),
  id: uuid,
  kind: z.enum(["expense", "withdrawal"]),
  concept: entityName,
  category: z.string(),
  amount: money,
  method: z.enum(["cash", "transfer"]),
  bankId: uuid.nullable(),
  bankSnapshot: settingsSchema.shape.banks.element.nullable(),
  cashId: uuid.nullable(),
  at: z.iso.datetime(),
  date: z.iso.date(),
});
export const tradingSnapshotShape = {
  clients: z.array(clientSchema),
  draft: draftSchema,
  accounts: z.array(accountSchema.omit({ purchases: true })),
  cash: cashSchema.nullable(),
  closings: z.array(closingSchema),
  outflows: z.array(outflowSchema),
  today: z.iso.date(),
};
export type ClientRecord = z.infer<typeof clientSchema>;
export type ClientInput = z.infer<typeof clientInputSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type SaleRecord = z.infer<typeof saleSchema>;
export type SaleLine = z.infer<typeof saleLineSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
export type PaymentRecord = z.infer<typeof paymentSchema>;
export type Account = z.infer<typeof accountSchema>;
export type AccountSummary = Omit<Account, "purchases">;
export type BankSnapshot = z.infer<typeof settingsSchema>["banks"][number];
export type Cash = z.infer<typeof cashSchema>;
export type Closing = z.infer<typeof closingSchema>;
export type Outflow = z.infer<typeof outflowSchema>;
export type TradingSnapshot = z.infer<z.ZodObject<typeof tradingSnapshotShape>>;
