import { randomUUID } from "node:crypto";
import type { Product, ProductInput, Recipe } from "../shared/contracts.ts";
import type { Db } from "./db/driver.ts";
import { DomainFault } from "./domain.ts";

type Row = Omit<Product, "active"> & { active: number };
export function products(db: Db): Product[] {
  return db
    .all<Row>("SELECT * FROM products ORDER BY name, id")
    .map((p) => ({ ...p, active: Boolean(p.active) }));
}
export function product(db: Db, id: string, active = true): Product {
  const p = db.get<Row>("SELECT * FROM products WHERE id = ?", id);
  if (!p) throw new DomainFault("E_NOT_FOUND", id);
  if (active && !p.active) throw new DomainFault("E_INACTIVE", id);
  return { ...p, active: Boolean(p.active) };
}
export function saveProduct(db: Db, input: ProductInput): string {
  const id = input.id ?? randomUUID();
  if (products(db).some((p) => p.id !== id && p.name.toLowerCase() === input.name.toLowerCase()))
    throw new DomainFault("E_PRODUCT_NAME");
  if (input.kind !== "material" && input.unit !== "piece") throw new DomainFault("E_KIND");
  if (input.id) {
    const previous = product(db, id, false);
    if (previous.kind !== input.kind || previous.unit !== input.unit)
      throw new DomainFault("E_KIND", id);
    db.run(
      "UPDATE products SET name=?, category=?, price=?, minStock=? WHERE id=?",
      input.name,
      input.category,
      input.price,
      input.minStock,
      id,
    );
  } else {
    db.run(
      "INSERT INTO products(id,name,category,kind,unit,price,minStock) VALUES(?,?,?,?,?,?,?)",
      id,
      input.name,
      input.category,
      input.kind,
      input.unit,
      input.price,
      input.minStock,
    );
  }
  return id;
}
export function saveRecipe(db: Db, recipe: Recipe): string {
  const p = product(db, recipe.productId);
  const m = product(db, recipe.materialId);
  if (p.kind !== "prepared" || m.kind !== "material" || m.unit !== "g")
    throw new DomainFault("E_RECIPE");
  if (recipe.packagingId) {
    const pack = product(db, recipe.packagingId);
    if (pack.kind !== "material" || pack.unit !== "piece") throw new DomainFault("E_RECIPE");
  }
  db.run(
    "INSERT INTO recipes VALUES(?,?,?,?) ON CONFLICT(productId) DO UPDATE SET materialId=excluded.materialId, grams=excluded.grams, packagingId=excluded.packagingId",
    recipe.productId,
    recipe.materialId,
    recipe.grams,
    recipe.packagingId,
  );
  return recipe.productId;
}
