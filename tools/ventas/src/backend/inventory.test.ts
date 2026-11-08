import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Action, MutationResult, ProductInput } from "../shared/contracts.ts";
import { type Db, openVentasDatabase } from "./db/driver.ts";
import { proportional } from "./domain.ts";
import { execute } from "./service.ts";
import { testState as snapshot } from "./test-state.ts";

let dir: string;
let db: Db;
const signal = new AbortController().signal;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ventas-test-"));
  db = openVentasDatabase(dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
function command(action: Action, key = randomUUID(), revision = snapshot(db).revision) {
  return { key, revision, action };
}
function run(action: Action): MutationResult {
  return execute(db, command(action), signal);
}
function idOf(result: MutationResult): string {
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") throw new Error(result.issue.code);
  return result.value.id;
}
function add(input: Partial<ProductInput> = {}) {
  return idOf(
    run({
      type: "saveProduct",
      product: {
        name: `Producto ${snapshot(db).products.length + 1}`,
        category: "Dulces",
        kind: "simple",
        unit: "piece",
        price: 1500,
        minStock: 2,
        ...input,
      },
    }),
  );
}
function receive(productId: string, qty: number, cost: number) {
  if (!snapshot(db).cash && product(productId).kind !== "prepared")
    idOf(run({ type: "openCash", initial: 0 }));
  return run({ type: "receive", productId, qty, cost, method: "cash", bankId: null });
}
function product(id: string) {
  const p = snapshot(db).products.find((p) => p.id === id);
  if (!p) throw new Error("Missing fixture");
  return p;
}
function recipe() {
  const materialId = add({ kind: "material", unit: "g", name: "Gomitas" });
  const packagingId = add({ kind: "material", name: "Bolsita" });
  const productId = add({ kind: "prepared", name: "Bolsita 100 g" });
  idOf(run({ type: "saveRecipe", recipe: { productId, materialId, grams: 100, packagingId } }));
  return { materialId, packagingId, productId };
}
describe("Ventas inventory", () => {
  it("starts empty, migrates once and persists on reopening", () => {
    expect(snapshot(db)).toMatchObject({
      revision: 0,
      products: [],
      movements: [],
      purchases: [],
      settings: { name: "", banks: [] },
    });
    const id = add();
    receive(id, 4, 333);
    db.close();
    db = openVentasDatabase(dir);
    expect(product(id)).toMatchObject({ stock: 4, value: 333 });
    expect(db.all("SELECT * FROM schema_migrations")).toHaveLength(6);
    expect(db.get<{ foreign_keys: number }>("PRAGMA foreign_keys")?.foreign_keys).toBe(1);
  });
  it("rejects duplicate product names on create and edit, including inactive names", () => {
    const first = add({ name: "Piñón" });
    const second = add({ name: "Otro" });
    idOf(run({ type: "setActive", id: first, active: false }));
    const before = snapshot(db);
    const duplicate = {
      name: "  PIÑÓN  ",
      category: "Dulces",
      kind: "simple" as const,
      unit: "piece" as const,
      price: 100,
      minStock: 0,
    };
    expect(run({ type: "saveProduct", product: duplicate })).toMatchObject({
      kind: "rejected",
      issue: { code: "E_PRODUCT_NAME" },
    });
    expect(run({ type: "saveProduct", product: { ...duplicate, id: second } })).toMatchObject({
      kind: "rejected",
      issue: { code: "E_PRODUCT_NAME" },
    });
    expect(snapshot(db)).toEqual(before);
    expect(run({ type: "saveProduct", product: { ...duplicate, id: first } }).kind).toBe("ok");
    expect(product(first).name).toBe("PIÑÓN");
  });
  it("rejects purchases of prepared bags without recording stock or purchases", () => {
    const r = recipe();
    const before = snapshot(db);
    expect(receive(r.productId, 2, 100)).toMatchObject({
      kind: "rejected",
      issue: { code: "E_PREPARED_PURCHASE" },
    });
    expect(snapshot(db)).toEqual(before);
  });
  it("updates catalog metadata, preserves stock and prevents kind/unit changes", () => {
    const id = add();
    receive(id, 2, 300);
    expect(
      run({
        type: "saveProduct",
        product: {
          id,
          name: "Nuevo",
          category: "Pan",
          kind: "simple",
          unit: "piece",
          price: 2000,
          minStock: 4,
        },
      }).kind,
    ).toBe("ok");
    expect(product(id)).toMatchObject({ name: "Nuevo", stock: 2, value: 300, minStock: 4 });
    expect(
      run({
        type: "saveProduct",
        product: {
          id,
          name: "Otro",
          category: "Pan",
          kind: "material",
          unit: "g",
          price: 0,
          minStock: 0,
        },
      }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_KIND" } });
  });
  it("calculates weighted costs, carries all final cents and revalues positive adjustments", () => {
    const id = add();
    receive(id, 3, 100);
    receive(id, 2, 110);
    expect(product(id)).toMatchObject({ stock: 5, value: 210 });
    run({ type: "adjust", productId: id, count: 3, waste: true, reason: "Rotura" });
    expect(product(id)).toMatchObject({ stock: 3, value: 126 });
    run({ type: "adjust", productId: id, count: 0, waste: true, reason: "Rotura" });
    expect(product(id)).toMatchObject({ stock: 0, value: 0, lastValue: 126, lastQty: 3 });
    run({ type: "adjust", productId: id, count: 2, waste: false, reason: "Conteo" });
    expect(product(id)).toMatchObject({ stock: 2, value: 84 });
  });
  it("prepares 100 g recipes plus packaging once and preserves total inventory value", () => {
    const r = recipe();
    receive(r.materialId, 1000, 333);
    receive(r.packagingId, 10, 21);
    const request = command({ type: "prepare", productId: r.productId, qty: 3 });
    const first = execute(db, request, signal);
    const second = execute(db, request, signal);
    expect(second).toEqual(first);
    expect(product(r.materialId)).toMatchObject({ stock: 700, value: 233 });
    expect(product(r.packagingId)).toMatchObject({ stock: 7, value: 15 });
    expect(product(r.productId)).toMatchObject({ stock: 3, value: 106 });
    expect(snapshot(db).products.reduce((sum, p) => sum + p.value, 0)).toBe(354);
  });
  it("rolls back material consumption when packaging is insufficient", () => {
    const r = recipe();
    receive(r.materialId, 1000, 1000);
    receive(r.packagingId, 1, 20);
    const before = snapshot(db);
    expect(run({ type: "prepare", productId: r.productId, qty: 2 })).toMatchObject({
      kind: "rejected",
      issue: { code: "E_STOCK", productId: r.packagingId },
    });
    expect(snapshot(db)).toEqual(before);
  });
  it("rejects insufficient raw material, missing recipes and invalid recipe units", () => {
    const r = recipe();
    expect(run({ type: "prepare", productId: r.productId, qty: 1 })).toMatchObject({
      kind: "rejected",
      issue: { code: "E_STOCK" },
    });
    const noRecipe = add({ kind: "prepared" });
    expect(run({ type: "prepare", productId: noRecipe, qty: 1 })).toMatchObject({
      kind: "rejected",
      issue: { code: "E_RECIPE" },
    });
    expect(
      run({ type: "saveRecipe", recipe: { ...r, materialId: r.packagingId, grams: 100 } }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_RECIPE" } });
  });
  it("prevents positive adjustments without known cost, increasing waste and empty changes", () => {
    const id = add();
    expect(
      run({ type: "adjust", productId: id, count: 1, waste: false, reason: "Conteo" }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_COST" } });
    expect(
      run({ type: "adjust", productId: id, count: 1, waste: true, reason: "Merma" }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_STOCK" } });
    expect(
      run({ type: "adjust", productId: id, count: 0, waste: false, reason: "Conteo" }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_NO_CHANGE" } });
  });
  it("deactivates without deleting history and blocks new movements", () => {
    const id = add();
    receive(id, 3, 100);
    idOf(run({ type: "setActive", id, active: false }));
    expect(receive(id, 1, 10)).toMatchObject({ kind: "rejected", issue: { code: "E_INACTIVE" } });
    expect(snapshot(db).movements).toHaveLength(1);
    idOf(run({ type: "setActive", id, active: true }));
    expect(receive(id, 1, 10).kind).toBe("ok");
  });
  it("rejects stale revisions from a second connection without partial writes", () => {
    const second = openVentasDatabase(dir);
    try {
      const stale = command({
        type: "saveSettings",
        settings: { name: "Concurrent", address: "", phone: "", thanks: "", banks: [] },
      });
      add();
      expect(execute(second, stale, signal)).toMatchObject({
        kind: "rejected",
        issue: { code: "E_REVISION" },
      });
      expect(snapshot(second).settings.name).toBe("");
    } finally {
      second.close();
    }
  });
  it("persists idempotency across restart and refuses reusing a key for another action", () => {
    const id = add();
    idOf(run({ type: "openCash", initial: 0 }));
    const request = command({
      type: "receive",
      productId: id,
      qty: 2,
      cost: 21,
      method: "cash",
      bankId: null,
    });
    const result = execute(db, request, signal);
    db.close();
    db = openVentasDatabase(dir);
    expect(execute(db, request, signal)).toEqual(result);
    expect(
      execute(db, { ...request, action: { ...request.action, qty: 3 } }, signal),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_DUPLICATE" } });
    expect(product(id).stock).toBe(2);
  });
  it("validates parameters, cancels before writes and preserves infrastructure errors", () => {
    const id = add();
    idOf(run({ type: "openCash", initial: 0 }));
    const request = command({
      type: "receive",
      productId: id,
      qty: 2,
      cost: 21,
      method: "cash",
      bankId: null,
    });
    expect(() =>
      execute(db, { ...request, action: { ...request.action, qty: 1.5 } }, signal),
    ).toThrow(expect.objectContaining({ code: "E_INVALID_PARAMS" }));
    const controller = new AbortController();
    controller.abort();
    expect(() => execute(db, request, controller.signal)).toThrow(
      expect.objectContaining({ code: "E_CANCELLED" }),
    );
    const originalRun = db.run;
    const broken: Db = {
      ...db,
      run: (sql, ...args) => {
        if (sql.startsWith("INSERT INTO operations")) throw new Error("disk full");
        originalRun(sql, ...args);
      },
    };
    expect(() => execute(broken, request, signal)).toThrow("disk full");
    expect(product(id).stock).toBe(0);
    expect(snapshot(db).purchases).toHaveLength(0);
  });
  it("rejects oversized stock and rolls back prior consumption", () => {
    const id = add();
    receive(id, 1_000_000_000, 100);
    const before = snapshot(db);
    expect(receive(id, 1, 1)).toMatchObject({ kind: "rejected", issue: { code: "E_LIMIT" } });
    expect(snapshot(db)).toEqual(before);
    expect(proportional(9_000_000_000_000, 999_999_999, 1_000_000_000)).toBe(8_999_999_991_000);
  });
  it("validates transfer account and stores separate purchase movement", () => {
    const id = add();
    const bankId = randomUUID();
    expect(
      run({ type: "receive", productId: id, qty: 1, cost: 200, method: "transfer", bankId }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_BANK" } });
    idOf(
      run({
        type: "saveSettings",
        settings: {
          name: "Tienda",
          address: "",
          phone: "",
          thanks: "Gracias",
          banks: [{ id: bankId, bank: "Banco", holder: "Persona", clabe: "012345678901234567" }],
        },
      }),
    );
    idOf(run({ type: "receive", productId: id, qty: 1, cost: 200, method: "transfer", bankId }));
    expect(snapshot(db).purchases[0]).toMatchObject({ cost: 200, bankId, method: "transfer" });
    expect(snapshot(db).movements[0]?.kind).toBe("purchase");
  });
});
