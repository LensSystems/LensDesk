import { z } from "zod";
import { correctionActionSchemas } from "./corrections-contracts.ts";
import { tradingActionSchemas, tradingSnapshotShape } from "./trading-contracts.ts";
import type { Settings } from "./values.ts";
import {
  money,
  entityName as name,
  quantity,
  settingsInputSchema,
  settingsSchema,
  uuid,
} from "./values.ts";

export type { Settings } from "./values.ts";
export { money, quantity, settingsSchema } from "./values.ts";

export const productSchema = z.strictObject({
  id: uuid.optional(),
  name,
  category: name,
  kind: z.enum(["simple", "material", "prepared"]),
  unit: z.enum(["piece", "g"]),
  price: money,
  minStock: quantity,
});
export const recipeSchema = z.strictObject({
  productId: uuid,
  materialId: uuid,
  grams: quantity.refine((n) => n > 0),
  packagingId: uuid.nullable(),
});
export const commandSchema = z.strictObject({
  key: uuid,
  revision: z.number().int().min(0),
  action: z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("saveProduct"), product: productSchema }),
    z.strictObject({ type: z.literal("setActive"), id: uuid, active: z.boolean() }),
    z.strictObject({ type: z.literal("saveRecipe"), recipe: recipeSchema }),
    z.strictObject({
      type: z.literal("receive"),
      productId: uuid,
      qty: quantity.refine((n) => n > 0),
      cost: money,
      method: z.enum(["cash", "transfer"]),
      bankId: uuid.nullable(),
    }),
    z.strictObject({
      type: z.literal("adjust"),
      productId: uuid,
      count: quantity,
      reason: z.string().trim().min(1).max(500),
      waste: z.boolean(),
    }),
    z.strictObject({
      type: z.literal("prepare"),
      productId: uuid,
      qty: quantity.refine((n) => n > 0),
    }),
    z.strictObject({ type: z.literal("saveSettings"), settings: settingsInputSchema }),
    ...tradingActionSchemas,
    ...correctionActionSchemas,
  ]),
});
export type Command = z.infer<typeof commandSchema>;
export type Action = Command["action"];
export type ProductInput = z.infer<typeof productSchema>;
export type Product = Required<ProductInput> & {
  stock: number;
  value: number;
  lastValue: number;
  lastQty: number;
  active: boolean;
};
export type Recipe = z.infer<typeof recipeSchema>;
export type Movement = {
  id: string;
  productId: string;
  qty: number;
  value: number;
  kind: "purchase" | "adjustment" | "waste" | "preparation" | "sale" | "return";
  referenceId: string;
  reason: string;
  at: string;
  date: string;
};
export type Purchase = {
  id: string;
  productId: string;
  qty: number;
  cost: number;
  method: "cash" | "transfer";
  bankId: string | null;
  cashId: string | null;
  bankSnapshot: import("./trading-contracts.ts").BankSnapshot | null;
  at: string;
  date: string;
};
export type Snapshot = {
  revision: number;
  settings: Settings;
  products: Product[];
  recipes: Recipe[];
  movements: Movement[];
  purchases: Purchase[];
} & import("./trading-contracts.ts").TradingSnapshot;
export const issueSchema = z.strictObject({
  code: z.enum([
    "E_NOT_FOUND",
    "E_PRODUCT_NAME",
    "E_PREPARED_PURCHASE",
    "E_INACTIVE",
    "E_STOCK",
    "E_RECIPE",
    "E_KIND",
    "E_COST",
    "E_NO_CHANGE",
    "E_REVISION",
    "E_DUPLICATE",
    "E_LIMIT",
    "E_BANK",
    "E_CLIENT",
    "E_CLIENT_NAME",
    "E_CREDIT",
    "E_PAYMENT",
    "E_CASH_CLOSED",
    "E_CASH_OPEN",
    "E_CASH_DIFFERENCE",
    "E_CART",
    "E_TOTAL",
    "E_BALANCE",
    "E_RETURN",
    "E_REVERSE",
    "E_REFUNDED_PAYMENT",
    "E_PERIOD",
    "E_BACKUP_FORMAT",
    "E_BACKUP_LIMIT",
    "E_BACKUP_REFS",
    "E_BACKUP_CHANGED",
    "E_BACKUP_EXPIRED",
    "E_BACKUP_HISTORY",
    "E_BACKUP_COST",
    "E_BACKUP_CLOSING",
    "E_BACKUP_COPY",
    "E_BACKUP_SOURCE",
  ]),
  productId: uuid.optional(),
});
export type VentasIssue = z.infer<typeof issueSchema>;
export type VentasResult<T> = { kind: "ok"; value: T } | { kind: "rejected"; issue: VentasIssue };
export const mutationResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("ok"),
    value: z.strictObject({ id: uuid, revision: z.number().int().min(0) }),
  }),
  z.strictObject({ kind: z.literal("rejected"), issue: issueSchema }),
]);
export type MutationResult = z.infer<typeof mutationResultSchema>;
export const snapshotResultSchema = z.strictObject({
  kind: z.literal("ok"),
  value: z.strictObject({
    revision: z.number().int().nonnegative(),
    settings: settingsSchema,
    products: z.array(
      productSchema.required().extend({
        stock: quantity,
        value: money,
        lastValue: money,
        lastQty: quantity.refine((n) => n > 0),
        active: z.boolean(),
      }),
    ),
    recipes: z.array(recipeSchema),
    movements: z.array(
      z.strictObject({
        id: uuid,
        productId: uuid,
        qty: z.number().int(),
        value: z.number().int(),
        kind: z.enum(["purchase", "adjustment", "waste", "preparation", "sale", "return"]),
        referenceId: uuid,
        reason: z.string(),
        at: z.iso.datetime(),
        date: z.iso.date(),
      }),
    ),
    ...tradingSnapshotShape,
    purchases: z.array(
      z.strictObject({
        id: uuid,
        productId: uuid,
        qty: quantity,
        cost: money,
        method: z.enum(["cash", "transfer"]),
        bankId: uuid.nullable(),
        cashId: uuid.nullable(),
        bankSnapshot: settingsSchema.shape.banks.element.nullable(),
        at: z.iso.datetime(),
        date: z.iso.date(),
      }),
    ),
  }),
});
