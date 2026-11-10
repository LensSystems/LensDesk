import type { Product } from "../shared/contracts.ts";
export type InventoryFilter = "all" | "low" | "prepared" | "material";
export function inventoryProducts(
  products: Product[],
  query: string,
  filter: InventoryFilter,
  locale: string,
) {
  const needle = query.toLocaleLowerCase(locale);
  return products.filter(
    (p) =>
      p.name.toLocaleLowerCase(locale).includes(needle) &&
      (filter === "all" || (filter === "low" ? p.stock <= p.minStock : p.kind === filter)),
  );
}
export function inventoryStatus(p: Product) {
  return !p.active
    ? "inactive"
    : p.stock === 0
      ? "noStock"
      : p.stock <= p.minStock
        ? "lowStock"
        : "goodStock";
}
