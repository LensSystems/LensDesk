import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Action } from "../shared/contracts.ts";
import { historyPageSchema, summarySchema } from "../shared/history-contracts.ts";
import { readDataset, replaceDataset } from "./backup-dataset.ts";
import { type Db, openVentasDatabase } from "./db/driver.ts";
import { query } from "./queries.ts";
import { execute, snapshot } from "./service.ts";

let db: Db, dir: string;
const signal = new AbortController().signal;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-07T18:00:00Z"));
  dir = mkdtempSync(join(tmpdir(), "ventas-readmodel-"));
  db = openVentasDatabase(dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
  vi.useRealTimers();
});
function run(action: Action) {
  const r = execute(db, { key: randomUUID(), revision: snapshot(db).revision, action }, signal);
  if (r.kind !== "ok") throw Error(r.issue.code);
  return r.value.id;
}
function read(name: "history" | "summary", params: unknown) {
  const r = query(db, name, params, signal);
  if (r.kind !== "ok") throw Error(r.issue.code);
  return r.value;
}
const client = (name: string) =>
  run({ type: "saveClient", client: { name, phone: "", term: 15, limit: null } });
it("keeps insertion order through edit, activation, reopen and dataset restore", () => {
  const z = client("Zeta"),
    a = client("Alfa"),
    m = client("Medio");
  run({ type: "saveClient", client: { id: z, name: "Beta", phone: "", term: 15, limit: null } });
  run({ type: "setClientActive", id: a, active: false });
  run({ type: "setClientActive", id: a, active: true });
  expect(snapshot(db).clients.map((c) => c.id)).toEqual([z, a, m]);
  const source = readDataset(db);
  db.close();
  db = openVentasDatabase(dir);
  expect(snapshot(db).clients.map((c) => c.id)).toEqual([z, a, m]);
  db.transaction(() => replaceDataset(db, source.data));
  expect(snapshot(db).clients.map((c) => c.id)).toEqual([z, a, m]);
  expect(readDataset(db).data).toEqual(source.data);
});
it("pages51 actual FIFO allocations50+1, preserves originals through reversal and rejects invalid read bounds", () => {
  run({ type: "openCash", initial: 0 });
  const cid = client("Cuenta FIFO");
  const sales = [];
  for (let i = 0; i < 51; i++)
    sales.push(
      run({
        type: "openingBalance",
        clientId: cid,
        amount: 100,
        due: "2026-11-10",
        note: `Saldo ${i}`,
      }),
    );
  const pid = run({
    type: "payAccount",
    clientId: cid,
    payment: { amount: 5050, received: 5050, method: "cash", bankId: null, reference: "FIFO" },
  });
  const bytes = JSON.stringify(db.all("SELECT * FROM payment_allocations ORDER BY rowid")),
    operations = JSON.stringify(db.all("SELECT * FROM operations ORDER BY rowid"));
  const readPage = (offset: number) => {
    const page = historyPageSchema.parse(
      read("history", { kind: "payments", paymentId: pid, allocationOffset: offset, limit: 1 }),
    );
    const row = page.rows[0];
    if (row?.kind !== "payment") throw Error("Payment absent");
    return row.data;
  };
  const first = readPage(0),
    second = readPage(50);
  expect(first.allocationPage).toMatchObject({ total: 51, nextOffset: 50 });
  expect(first.allocationPage?.rows).toHaveLength(50);
  expect(first.allocationPage?.rows.map((a) => a.saleId)).toEqual(sales.slice(0, 50));
  expect(second.allocationPage).toMatchObject({
    total: 51,
    nextOffset: null,
    rows: [{ saleId: sales[50], amount: 50, opening: true }],
  });
  expect(snapshot(db).accounts[0]?.balance).toBe(50);
  expect(JSON.stringify(db.all("SELECT * FROM payment_allocations ORDER BY rowid"))).toBe(bytes);
  expect(JSON.stringify(db.all("SELECT * FROM operations ORDER BY rowid"))).toBe(operations);
  run({ type: "reversePayment", paymentId: pid, reason: "Reversa real" });
  expect(readPage(50).reversal).not.toBeNull();
  expect(snapshot(db).accounts[0]?.balance).toBe(5100);
  expect(JSON.stringify(db.all("SELECT * FROM payment_allocations ORDER BY rowid"))).toBe(bytes);
  expect(() =>
    read("history", { kind: "payments", paymentId: pid, allocationOffset: -1 }),
  ).toThrow();
  expect(query(db, "history", { kind: "sales", paymentId: pid }, signal)).toMatchObject({
    kind: "rejected",
  });
});
it("preserves original folios and missing history in allocation reads without rewriting origin bytes", () => {
  run({ type: "openCash", initial: 0 });
  const cid = client("Original"),
    sid = run({
      type: "openingBalance",
      clientId: cid,
      amount: 100,
      due: "2026-11-10",
      note: "Original",
    });
  const pid = run({
    type: "payAccount",
    clientId: cid,
    payment: { amount: 50, received: 50, method: "cash", bankId: null, reference: "" },
  });
  db.run(
    "INSERT INTO origins VALUES(?,?,?,?,?)",
    "sales",
    sid,
    "PREVIO-ORIGINAL",
    "PREVIO-ORIGINAL",
    '["business"]',
  );
  const before = JSON.stringify(readDataset(db).data);
  const p = historyPageSchema.parse(
    read("history", { kind: "payments", paymentId: pid, allocationOffset: 0 }),
  );
  expect(p.rows[0]).toMatchObject({
    kind: "payment",
    data: {
      allocationPage: {
        rows: [{ legacyFolio: "PREVIO-ORIGINAL", historyMissing: ["business"], amount: 50 }],
      },
    },
  });
  expect(JSON.stringify(readDataset(db).data)).toBe(before);
});
it("keeps first product encounter for top ties, subtracts returns and accepts custom API ranges without writes", () => {
  run({ type: "openCash", initial: 10000 });
  const products = ["Zeta", "Alfa"].map((name) =>
    run({
      type: "saveProduct",
      product: { name, category: "Dulces", kind: "simple", unit: "piece", price: 100, minStock: 0 },
    }),
  );
  for (const id of products)
    run({ type: "receive", productId: id, qty: 5, cost: 100, method: "cash", bankId: null });
  // Reverse UUID lexical order deliberately so a tie cannot accidentally pass an ID sort.
  products.sort((a, b) => b.localeCompare(a));
  run({
    type: "saveDraft",
    draft: { clientId: null, lines: products.map((productId) => ({ productId, qty: 2 })) },
  });
  const sid = run({
    type: "sell",
    expectedTotal: 400,
    payment: { amount: 400, received: 400, method: "cash", bankId: null, reference: "" },
    exception: "",
  });
  const s = summarySchema.parse(read("summary", { from: "2026-11-01", to: "2026-11-09" }));
  expect(s.top.map((p) => p.productId)).toEqual(products);
  expect(s.revenue).toBe(400);
  expect(s.received).toBe(400);
  const line = JSON.parse(
    db.get<{ lines: string }>("SELECT lines FROM sales WHERE id=?", sid)?.lines ?? "[]",
  )[0];
  run({
    type: "returnSale",
    saleId: sid,
    items: [{ lineId: line.id, qty: 1 }],
    restock: true,
    reason: "Devolución",
    refund: { method: "cash", bankId: null, reference: "" },
  });
  const before = JSON.stringify(readDataset(db).data),
    result = summarySchema.parse(read("summary", { from: "2026-11-01", to: "2026-11-09" }));
  expect(result.top.map((p) => p.qty)).toEqual([2, 1]);
  expect(result.revenue).toBe(300);
  expect(result.received).toBe(300);
  expect(result.count).toBe(1);
  expect(
    summarySchema.parse(read("summary", { from: "2026-10-01", to: "2026-10-31" })).revenue,
  ).toBe(0);
  expect(JSON.stringify(readDataset(db).data)).toBe(before);
});

it("uses insertion encounter for top ties even when operational dates are not in insertion order", () => {
  run({ type: "openCash", initial: 10000 });
  const ids = ["Primero", "Segundo"].map((name) =>
    run({
      type: "saveProduct",
      product: { name, category: "Pan", kind: "simple", unit: "piece", price: 100, minStock: 0 },
    }),
  );
  for (const id of ids)
    run({ type: "receive", productId: id, qty: 3, cost: 100, method: "cash", bankId: null });
  for (const [i, productId] of ids.entries()) {
    vi.setSystemTime(new Date(i === 0 ? "2026-11-07T18:00:00Z" : "2026-11-06T18:00:00Z"));
    run({ type: "saveDraft", draft: { clientId: null, lines: [{ productId, qty: 1 }] } });
    run({
      type: "sell",
      expectedTotal: 100,
      payment: { amount: 100, received: 100, method: "cash", bankId: null, reference: "" },
      exception: "",
    });
  }
  const before = JSON.stringify(readDataset(db).data);
  expect(
    summarySchema
      .parse(read("summary", { from: "2026-11-01", to: "2026-11-09" }))
      .top.map((p) => p.productId),
  ).toEqual(ids);
  expect(JSON.stringify(readDataset(db).data)).toBe(before);
});
