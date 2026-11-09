import { describe, expect, it } from "vitest";
import type { Product, Recipe } from "../shared/contracts.ts";
import { inventoryProducts, inventoryStatus } from "./inventory-view.ts";
import { preparationPreview } from "./preparation-preview.ts";

const product: Product = {
  id: "bag",
  name: "Bag",
  category: "Other",
  kind: "prepared",
  unit: "piece",
  price: 100,
  minStock: 5,
  icon: null,
  stock: 0,
  value: 0,
  lastQty: 1,
  lastValue: 0,
  active: true,
};
const material: Product = {
  ...product,
  id: "raw",
  name: "Raw",
  kind: "material",
  unit: "g",
  stock: 3,
  value: 1,
  lastQty: 3,
  lastValue: 1,
};
const pack: Product = { ...material, id: "pack", name: "Pack", unit: "piece" };
const recipe: Recipe = {
  productId: product.id,
  materialId: material.id,
  grams: 1,
  packagingId: pack.id,
};
const preview = (qty: number, m = material, p = pack) =>
  preparationPreview(product, recipe, [m, p], qty);
describe("inventory preparation preview", () => {
  it("rounds native rational costs per component before summing", () => {
    expect(preview(1)).toMatchObject({ cost: 0, grams: 1, result: 1, issue: null });
    expect(preview(2)).toMatchObject({ cost: 2, grams: 2, result: 2, issue: null });
  });
  it("uses the complete value when consuming exactly all stock", () => {
    expect(preview(3)).toMatchObject({ cost: 2, issue: null });
    expect(
      preview(1, { ...material, stock: 1, value: 9000000000000 }, { ...pack, value: 0 }),
    ).toMatchObject({ cost: 9000000000000, issue: null });
  });
  it("estimates exhausted stock using its actual last fraction and blocks confirmation", () => {
    expect(
      preview(2, { ...material, stock: 0, value: 0, lastQty: 3, lastValue: 10 }),
    ).toMatchObject({ cost: 8, issue: "E_STOCK" });
    expect(preview(2, { ...material, stock: 0, value: 0, lastQty: 1, lastValue: 0 })).toMatchObject(
      { cost: 1, issue: "E_STOCK" },
    );
  });
  it("rejects missing recipes, inactive components and insufficient packaging", () => {
    expect(preparationPreview(product, undefined, [], 10).issue).toBe("E_RECIPE");
    expect(preview(1, { ...material, active: false }).issue).toBe("E_INACTIVE");
    expect(preview(2, material, { ...pack, stock: 1 }).issue).toBe("E_STOCK");
  });
  it.each([0, -1, 1.5, NaN, Infinity, 1000000001])("bounds invalid quantities %s", (qty) =>
    expect(preview(qty).issue).toBe("E_LIMIT"),
  );
  it("bounds quantity products and money sums without float multiplication", () => {
    expect(
      preparationPreview(product, { ...recipe, grams: 1000000000 }, [material, pack], 2).issue,
    ).toBe("E_LIMIT");
    expect(
      preview(1, { ...material, stock: 1, value: 9000000000000 }, { ...pack, stock: 1, value: 1 })
        .issue,
    ).toBe("E_LIMIT");
  });
  it("keeps inactive rows, equality to minimum, insertion order and independent name search", () => {
    const rows = [
      { ...product, id: "a", name: "A", stock: 5, active: false },
      { ...material, id: "b", name: "B", stock: 6 },
      { ...product, id: "c", name: "C", stock: 5 },
    ];
    expect(inventoryProducts(rows, "", "low", "es").map((p) => p.id)).toEqual(["a", "c"]);
    expect(inventoryProducts(rows, "A", "all", "es").map((p) => p.id)).toEqual(["a"]);
    expect(inventoryProducts(rows, "Other", "all", "es")).toEqual([]);
    expect(inventoryProducts(rows, "", "prepared", "es").map((p) => p.id)).toEqual(["a", "c"]);
    expect(inventoryProducts(rows, "", "material", "es").map((p) => p.id)).toEqual(["b"]);
    expect(rows.map(inventoryStatus)).toEqual(["inactive", "goodStock", "lowStock"]);
    expect(inventoryStatus(product)).toBe("noStock");
  });
});
