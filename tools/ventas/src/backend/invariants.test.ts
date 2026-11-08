import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Action, snapshotResultSchema } from "../shared/contracts.ts";
import type { PaymentInput } from "../shared/trading-contracts.ts";
import { type Db, openVentasDatabase } from "./db/driver.ts";
import { snapshot as compactSnapshot, execute } from "./service.ts";
import { testState as snapshot } from "./test-state.ts";

const max = 9_000_000_000_000;
let dir: string, db: Db;
const signal = new AbortController().signal;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ventas-invariants-"));
  db = openVentasDatabase(dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
function run(action: Action) {
  return execute(db, { key: randomUUID(), revision: snapshot(db).revision, action }, signal);
}
function ok(action: Action): string {
  const result = run(action);
  if (result.kind !== "ok") throw new Error(result.issue.code);
  return result.value.id;
}
const pay = (amount: number, bankId: string | null = null): PaymentInput => ({
  amount,
  received: amount,
  method: bankId ? "transfer" : "cash",
  bankId,
  reference: "",
});
function setup(initial = 0, price = 1) {
  ok({ type: "openCash", initial });
  const pid = ok({
    type: "saveProduct",
    product: { name: "A", category: "Dulces", kind: "simple", unit: "piece", price, minStock: 0 },
  });
  ok({ type: "receive", productId: pid, qty: 10, cost: 0, method: "cash", bankId: null });
  return pid;
}
function cart(pid: string, clientId: string | null = null, qty = 1) {
  ok({ type: "saveDraft", draft: { clientId, lines: [{ productId: pid, qty }] } });
}
const sale = (amount: number, payment = pay(amount)): Action => ({
  type: "sell",
  expectedTotal: amount,
  payment,
  exception: "",
});
function rejectAtomically(action: Action) {
  const before = snapshot(db),
    sequences = db.all("SELECT * FROM sequences ORDER BY name"),
    key = randomUUID();
  expect(execute(db, { key, revision: before.revision, action }, signal)).toMatchObject({
    kind: "rejected",
    issue: { code: "E_LIMIT" },
  });
  expect(snapshot(db)).toEqual(before);
  expect(db.all("SELECT * FROM sequences ORDER BY name")).toEqual(sequences);
  expect(db.get("SELECT * FROM operations WHERE key=?", key)).toBeUndefined();
  expect(snapshotResultSchema.safeParse({ kind: "ok", value: compactSnapshot(db) }).success).toBe(
    true,
  );
}
function transferClient() {
  const bankId = randomUUID();
  ok({
    type: "saveSettings",
    settings: {
      name: "",
      address: "",
      phone: "",
      thanks: "",
      banks: [{ id: bankId, bank: "Banco", holder: "Titular", clabe: "012345678901234567" }],
    },
  });
  const cid = ok({
    type: "saveClient",
    client: { name: "Cliente", phone: "", term: 15, limit: null },
  });
  return { bankId, cid };
}
function price(pid: string, value: number) {
  ok({
    type: "saveProduct",
    product: {
      id: pid,
      name: "A",
      category: "Dulces",
      kind: "simple",
      unit: "piece",
      price: value,
      minStock: 0,
    },
  });
}

describe("Ventas aggregate invariants", () => {
  it("rejects a one-cent sale that overflows opening float plus receipts", () => {
    const pid = setup(max);
    cart(pid);
    rejectAtomically(sale(1));
    expect(snapshot(db).cash).toMatchObject({ initial: max, ins: 0, expected: max });
  });
  it("rejects cumulative cash receipts even when withdrawals leave room in expected cash", () => {
    const pid = setup(0, max);
    cart(pid);
    ok(sale(max));
    ok({ type: "outflow", kind: "withdrawal", concept: "Retiro", category: "", payment: pay(max) });
    price(pid, 1);
    cart(pid);
    rejectAtomically(sale(1));
  });
  it("rejects cumulative outflows and purchases even when receipts replenish the drawer", () => {
    const pid = setup(max, max);
    ok({ type: "receive", productId: pid, qty: 1, cost: max, method: "cash", bankId: null });
    cart(pid);
    ok(sale(max));
    rejectAtomically({
      type: "outflow",
      kind: "expense",
      concept: "Extra",
      category: "",
      payment: pay(1),
    });
    rejectAtomically({
      type: "receive",
      productId: pid,
      qty: 1,
      cost: 1,
      method: "cash",
      bankId: null,
    });
  });
  it("rejects combined expenses and withdrawals above the bound", () => {
    const pid = setup(max, max);
    ok({ type: "outflow", kind: "expense", concept: "Gasto", category: "", payment: pay(max) });
    cart(pid);
    ok(sale(max));
    rejectAtomically({
      type: "outflow",
      kind: "withdrawal",
      concept: "Retiro",
      category: "",
      payment: pay(1),
    });
    rejectAtomically({
      type: "outflow",
      kind: "expense",
      concept: "Otro gasto",
      category: "",
      payment: pay(1),
    });
  });
  it("rejects a settled transfer sale exceeding lifetime account totalPaid", () => {
    const pid = setup(0, max),
      { bankId, cid } = transferClient();
    cart(pid, cid);
    ok(sale(max, pay(max, bankId)));
    expect(snapshot(db).accounts[0]?.totalPaid).toBe(max);
    price(pid, 1);
    cart(pid, cid);
    rejectAtomically(sale(1, pay(1, bankId)));
  });
  it("rejects payment exceeding lifetime totalPaid without losing the outstanding purchase", () => {
    const pid = setup(0, max),
      { bankId, cid } = transferClient();
    cart(pid, cid);
    ok(sale(max, pay(max, bankId)));
    price(pid, 1);
    cart(pid, cid);
    ok(sale(1, pay(0)));
    rejectAtomically({ type: "payAccount", clientId: cid, payment: pay(1, bankId) });
    expect(snapshot(db).accounts[0]).toMatchObject({ balance: 1, totalPaid: max });
  });
  it("rejects opening debt overflow and permits bounded opening cash and opening debt", () => {
    const { cid } = transferClient();
    ok({
      type: "openingBalance",
      clientId: cid,
      amount: max,
      due: "2026-12-31",
      note: "Saldo previo real",
    });
    rejectAtomically({
      type: "openingBalance",
      clientId: cid,
      amount: 1,
      due: "2026-12-31",
      note: "Otro saldo",
    });
    ok({ type: "openCash", initial: max });
    expect(snapshotResultSchema.safeParse({ kind: "ok", value: compactSnapshot(db) }).success).toBe(
      true,
    );
  });
  it("does not recalculate financial aggregates when saving the cart", () => {
    const pid = setup(),
      revision = snapshot(db).revision;
    const proxy: Db = {
      ...db,
      all: <T>(sql: string, ...args: (string | number | null)[]) => {
        if (/FROM (?:sales|payments|purchases|outflows)\b/.test(sql))
          throw new Error("Unrelated aggregate read");
        return db.all<T>(sql, ...args);
      },
    };
    expect(
      execute(
        proxy,
        {
          key: randomUUID(),
          revision,
          action: {
            type: "saveDraft",
            draft: { clientId: null, lines: [{ productId: pid, qty: 1 }] },
          },
        },
        signal,
      ).kind,
    ).toBe("ok");
  });
});

describe("Ventas stale draft and outflow reference", () => {
  it("reduces and removes stale or inactive lines while preserving the other product", () => {
    const a = setup(),
      b = ok({
        type: "saveProduct",
        product: {
          name: "B",
          category: "Dulces",
          kind: "simple",
          unit: "piece",
          price: 1,
          minStock: 0,
        },
      });
    ok({ type: "receive", productId: b, qty: 2, cost: 0, method: "cash", bankId: null });
    ok({
      type: "saveDraft",
      draft: {
        clientId: null,
        lines: [
          { productId: a, qty: 5 },
          { productId: b, qty: 1 },
        ],
      },
    });
    ok({ type: "adjust", productId: a, count: 2, reason: "Conteo", waste: true });
    ok({
      type: "saveDraft",
      draft: {
        clientId: null,
        lines: [
          { productId: a, qty: 4 },
          { productId: b, qty: 1 },
        ],
      },
    });
    const before = snapshot(db);
    expect(
      run({
        type: "saveDraft",
        draft: {
          clientId: null,
          lines: [
            { productId: a, qty: 5 },
            { productId: b, qty: 1 },
          ],
        },
      }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_STOCK" } });
    expect(run(sale(5))).toMatchObject({ kind: "rejected", issue: { code: "E_STOCK" } });
    expect(snapshot(db)).toEqual(before);
    ok({ type: "setActive", id: a, active: false });
    ok({
      type: "saveDraft",
      draft: {
        clientId: null,
        lines: [
          { productId: a, qty: 3 },
          { productId: b, qty: 1 },
        ],
      },
    });
    expect(run(sale(4))).toMatchObject({ kind: "rejected", issue: { code: "E_INACTIVE" } });
    ok({ type: "saveDraft", draft: { clientId: null, lines: [{ productId: b, qty: 1 }] } });
    expect(snapshot(db).draft.lines).toEqual([{ productId: b, qty: 1 }]);
    expect(
      run({
        type: "saveDraft",
        draft: {
          clientId: null,
          lines: [
            { productId: a, qty: 1 },
            { productId: b, qty: 1 },
          ],
        },
      }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_STOCK" } });
    expect(snapshot(db).products.find((p) => p.id === a)?.stock).toBe(2);
  });
  it("persists a captured expense and withdrawal reference across restart", () => {
    setup();
    const { bankId } = transferClient();
    const expense = ok({
      type: "outflow",
      kind: "expense",
      concept: "Pasaje",
      category: "Ruta",
      payment: { ...pay(10, bankId), reference: "REF-GASTO-123" },
    });
    const withdrawal = ok({
      type: "outflow",
      kind: "withdrawal",
      concept: "Retiro",
      category: "",
      payment: { ...pay(20, bankId), reference: "REF-RETIRO-456" },
    });
    db.close();
    db = openVentasDatabase(dir);
    expect(snapshot(db).outflows.find((o) => o.id === expense)?.reference).toBe("REF-GASTO-123");
    expect(snapshot(db).outflows.find((o) => o.id === withdrawal)?.reference).toBe(
      "REF-RETIRO-456",
    );
  });
});
