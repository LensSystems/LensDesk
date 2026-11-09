import type { Product, Recipe } from "../shared/contracts.ts";
import { proportionalInteger } from "../shared/proportional.ts";

const maxMoney = 9_000_000_000_000,
  maxQty = 1_000_000_000;
const valid = (n: number, max: number) => Number.isSafeInteger(n) && n >= 0 && n <= max;
function portion(p: Product, qty: number) {
  if (
    !valid(p.stock, maxQty) ||
    !valid(p.value, maxMoney) ||
    !valid(p.lastValue, maxMoney) ||
    !valid(p.lastQty, maxQty) ||
    !p.lastQty
  )
    return null;
  const value = p.stock ? p.value : p.lastValue,
    stock = p.stock || p.lastQty;
  const cost =
    p.stock && qty === p.stock ? BigInt(p.value) : proportionalInteger(value, qty, stock);
  return cost <= BigInt(maxMoney) ? cost : null;
}
export function preparationPreview(
  product: Product | undefined,
  recipe: Recipe | undefined,
  products: Product[],
  qty: number,
) {
  const material = products.find((p) => p.id === recipe?.materialId);
  const pack = products.find((p) => p.id === recipe?.packagingId);
  if (
    product?.kind !== "prepared" ||
    !recipe ||
    !material ||
    material.kind !== "material" ||
    material.unit !== "g" ||
    (recipe.packagingId && (pack?.kind !== "material" || pack.unit !== "piece"))
  )
    return { issue: "E_RECIPE" as const };
  if (
    !valid(product.stock, maxQty) ||
    !valid(product.value, maxMoney) ||
    !valid(qty, maxQty) ||
    !qty ||
    !valid(recipe.grams, maxQty) ||
    !recipe.grams ||
    BigInt(recipe.grams) * BigInt(qty) > BigInt(maxQty) ||
    BigInt(product.stock) + BigInt(qty) > BigInt(maxQty)
  )
    return { issue: "E_LIMIT" as const };
  const grams = recipe.grams * qty,
    materialCost = portion(material, grams),
    packCost = pack ? portion(pack, qty) : 0n;
  if (
    materialCost === null ||
    packCost === null ||
    materialCost + packCost > BigInt(maxMoney) ||
    BigInt(product.value) + materialCost + packCost > BigInt(maxMoney)
  )
    return { issue: "E_LIMIT" as const };
  const cost = Number(materialCost + packCost);
  const issue =
    !product.active || !material.active || (pack && !pack.active)
      ? ("E_INACTIVE" as const)
      : grams > material.stock || (pack && qty > pack.stock)
        ? ("E_STOCK" as const)
        : null;
  return { issue, material, pack, grams, cost, result: product.stock + qty };
}
