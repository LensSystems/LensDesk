import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Action, snapshotResultSchema } from "../shared/contracts.ts";
import {
  historyPageSchema,
  returnDetailSchema,
  saleDetailSchema,
  statementSchema,
  summarySchema,
} from "../shared/history-contracts.ts";
import type { PaymentInput } from "../shared/trading-contracts.ts";
import { type Db, openVentasDatabase } from "./db/driver.ts";
import { query } from "./queries.ts";
import { execute, snapshot } from "./service.ts";
import { testState } from "./test-state.ts";

let db: Db, dir: string;
const signal = new AbortController().signal,
  now = "2026-11-07T18:00:00Z";
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));
  dir = mkdtempSync(join(tmpdir(), "ventas-corrections-"));
  db = openVentasDatabase(dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
  vi.useRealTimers();
});
const command = (action: Action) => ({
  key: randomUUID(),
  revision: snapshot(db).revision,
  action,
});
function run(action: Action) {
  return execute(db, command(action), signal);
}
function ok(action: Action) {
  const r = run(action);
  if (r.kind !== "ok") throw new Error(r.issue.code);
  return r.value.id;
}
function value(name: Parameters<typeof query>[1], params: unknown) {
  const r = query(db, name, params, signal);
  if (r.kind !== "ok") throw new Error(r.issue.code);
  return r.value;
}
const detail = (id: string) => saleDetailSchema.parse(value("saleDetail", { saleId: id }));
const summary = (from = "2026-11-07", to = from) =>
  summarySchema.parse(value("summary", { from, to }));
const pay = (amount: number, bankId: string | null = null): PaymentInput => ({
  amount,
  received: amount,
  method: bankId ? "transfer" : "cash",
  bankId,
  reference: "REF",
});
function setup(price = 100, qty = 3, cost = 100) {
  ok({ type: "openCash", initial: 100000 });
  const p = ok({
    type: "saveProduct",
    product: {
      name: "Gomitas",
      category: "Dulces",
      kind: "simple",
      unit: "piece",
      price,
      minStock: 0,
    },
  });
  ok({ type: "receive", productId: p, qty, cost, method: "cash", bankId: null });
  return p;
}
function customer(name = "Cliente") {
  return ok({ type: "saveClient", client: { name, phone: "", term: 15, limit: null } });
}
function bank() {
  const id = randomUUID();
  ok({
    type: "saveSettings",
    settings: {
      name: "Negocio original",
      address: "Calle 1",
      phone: "123",
      thanks: "Gracias original",
      banks: [
        { id, bank: "Banco original", holder: "Titular original", clabe: "012345678901234567" },
      ],
    },
  });
  return id;
}
function sell(
  pid: string,
  qty = 3,
  cid: string | null = null,
  amount = 300,
  bankId: string | null = null,
) {
  ok({ type: "saveDraft", draft: { clientId: cid, lines: [{ productId: pid, qty }] } });
  return ok({
    type: "sell",
    expectedTotal: qty * (snapshot(db).products.find((p) => p.id === pid)?.price ?? 0),
    payment: pay(amount, bankId),
    exception: "",
  });
}
function returnAction(
  id: string,
  qty: number,
  restock = true,
): Extract<Action, { type: "returnSale" }> {
  return {
    type: "returnSale",
    saleId: id,
    items: [{ lineId: detail(id).sale.lines[0]?.id ?? "", qty }],
    restock,
    reason: "Devolución justificada",
    refund: { method: "cash", bankId: null, reference: "REF-DEV" },
  };
}

describe("Ventas corrections", () => {
  it("returns successive rounded costs exactly and never repeats stock/refund", () => {
    const p = setup(),
      sale = sell(p),
      original = detail(sale).sale;
    const first = command(returnAction(sale, 1));
    expect(execute(db, first, signal).kind).toBe("ok");
    expect(execute(db, first, signal).kind).toBe("ok");
    ok(returnAction(sale, 1));
    ok(returnAction(sale, 1));
    const data = testState(db);
    expect(data.returns.map((r) => r.cost)).toEqual([33, 34, 33]);
    expect(data.products[0]).toMatchObject({ stock: 3, value: 100 });
    expect(detail(sale).balance).toMatchObject({ total: 0, paid: 0, pending: 0 });
    expect(detail(sale).sale).toEqual(original);
    expect(data.cash).toMatchObject({ ins: 300, refunds: 300, expected: 99900 });
    const before = testState(db);
    expect(run(returnAction(sale, 1))).toMatchObject({
      kind: "rejected",
      issue: { code: "E_RETURN" },
    });
    expect(testState(db)).toEqual(before);
  });
  it("reduces debt before refund and uses a new cash session without changing old closure", () => {
    const p = setup(),
      cid = customer(),
      sale = sell(p, 3, cid, 100);
    const expected = snapshot(db).cash?.expected ?? 0;
    ok({ type: "closeCash", counted: expected, reason: "" });
    const closing = snapshot(db).closings[0];
    ok(returnAction(sale, 1));
    expect(detail(sale).balance).toMatchObject({ total: 200, paid: 100, pending: 100 });
    expect(testState(db).returns[0]?.refund).toBe(0);
    ok({ type: "openCash", initial: 200 });
    const session = snapshot(db).cash?.id;
    ok(returnAction(sale, 2));
    expect(testState(db).returns[1]).toMatchObject({ refund: 100, cashId: session });
    expect(snapshot(db).cash).toMatchObject({ refunds: 100, expected: 100 });
    expect(snapshot(db).closings[0]).toEqual(closing);
  });
  it("restocks deactivated products without activating them and records unsellable loss without double stock use", () => {
    const p = setup(),
      sale = sell(p);
    ok({ type: "setActive", id: p, active: false });
    ok(returnAction(sale, 1, true));
    ok(returnAction(sale, 2, false));
    expect(snapshot(db).products[0]).toMatchObject({ active: false, stock: 1, value: 33 });
    expect(snapshot(db).movements.filter((m) => m.kind === "return")).toHaveLength(1);
    expect(summary()).toMatchObject({ revenue: 0, cogs: 0, loss: 67, profit: -67, received: 0 });
  });
  it("returns free products and rejects opening balances, duplicate lines and quantities", () => {
    const p = setup(0, 1, 0),
      cid = customer(),
      sale = sell(p, 1, null, 0);
    ok(returnAction(sale, 1));
    expect(snapshot(db).products[0]?.stock).toBe(1);
    const opening = ok({
      type: "openingBalance",
      clientId: cid,
      amount: 100,
      due: "2026-12-01",
      note: "Saldo previo",
    });
    expect(
      run({
        type: "returnSale",
        saleId: opening,
        items: [{ lineId: randomUUID(), qty: 1 }],
        restock: true,
        reason: "Motivo",
        refund: { method: "cash", bankId: null, reference: "" },
      }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_RETURN" } });
    const p2 = ok({
      type: "saveProduct",
      product: {
        name: "Otro",
        category: "D",
        kind: "simple",
        unit: "piece",
        price: 1,
        minStock: 0,
      },
    });
    ok({ type: "receive", productId: p2, qty: 2, cost: 1, method: "cash", bankId: null });
    const s2 = sell(p2, 2, null, 2),
      a = returnAction(s2, 1);
    expect(run({ ...a, items: [...a.items, ...a.items] })).toMatchObject({
      kind: "rejected",
      issue: { code: "E_RETURN" },
    });
  });
  it("reverses a multi-purchase FIFO payment using its historical transfer bank", () => {
    const p = setup(),
      bid = bank(),
      cid = customer();
    ok({
      type: "openingBalance",
      clientId: cid,
      amount: 100,
      due: "2026-11-07",
      note: "Saldo previo",
    });
    const s = sell(p, 2, cid, 0);
    const paymentId = ok({ type: "payAccount", clientId: cid, payment: pay(150, bid) }),
      before = testState(db).payments.find((p) => p.id === paymentId);
    ok({
      type: "saveSettings",
      settings: { name: "Nuevo", address: "", phone: "", thanks: "", banks: [] },
    });
    const reverse = ok({ type: "reversePayment", paymentId, reason: "Pago registrado por error" });
    const data = testState(db);
    expect(data.accounts[0]).toMatchObject({ balance: 300, totalPaid: 0 });
    expect(detail(s).balance.pending).toBe(200);
    expect(data.reversals[0]).toMatchObject({
      id: reverse,
      paymentId,
      amount: 150,
      bankSnapshot: before?.bankSnapshot,
    });
    expect(data.payments.find((p) => p.id === paymentId)?.allocations).toEqual(before?.allocations);
    expect(run({ type: "reversePayment", paymentId, reason: "Otra vez" })).toMatchObject({
      kind: "rejected",
      issue: { code: "E_REVERSE" },
    });
  });
  it("blocks counter, opening payments and payments linked to refunds", () => {
    const p = setup(),
      counter = sell(p);
    expect(
      run({
        type: "reversePayment",
        paymentId: detail(counter).initialPayment?.id ?? "",
        reason: "Error",
      }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_REVERSE" } });
    const cid = customer();
    ok({ type: "receive", productId: p, qty: 3, cost: 0, method: "cash", bankId: null });
    const s = sell(p, 3, cid, 300),
      initial = detail(s).initialPayment?.id ?? "";
    ok(returnAction(s, 1));
    expect(run({ type: "reversePayment", paymentId: initial, reason: "Error" })).toMatchObject({
      kind: "rejected",
      issue: { code: "E_REFUNDED_PAYMENT" },
    });
    const debt = ok({
        type: "openingBalance",
        clientId: cid,
        amount: 100,
        due: "2026-12-01",
        note: "Previo",
      }),
      paymentId = ok({ type: "payAccount", clientId: cid, payment: pay(100) });
    db.run("UPDATE payments SET opening=1,cashId=NULL WHERE id=?", paymentId);
    expect(detail(debt).sale.opening).toBe(true);
    expect(run({ type: "reversePayment", paymentId, reason: "Error" })).toMatchObject({
      kind: "rejected",
      issue: { code: "E_REVERSE" },
    });
  });
  it("keeps cash closures immutable when reversing a payment in a later session", () => {
    const p = setup(),
      cid = customer(),
      s = sell(p, 3, cid, 100),
      paymentId = detail(s).initialPayment?.id ?? "";
    ok({ type: "closeCash", counted: snapshot(db).cash?.expected ?? 0, reason: "" });
    const previous = snapshot(db).closings[0];
    ok({ type: "openCash", initial: 200 });
    const current = snapshot(db).cash?.id;
    ok({ type: "reversePayment", paymentId, reason: "Error de captura" });
    expect(testState(db).reversals[0]?.cashId).toBe(current);
    expect(snapshot(db).cash).toMatchObject({ reversals: 100, expected: 100 });
    expect(snapshot(db).closings[0]).toEqual(previous);
    expect(detail(s).balance.pending).toBe(300);
  });
  it("rolls back return stock, payment effects, folios and idempotency on disk failure or cancellation", () => {
    const p = setup(),
      s = sell(p),
      before = testState(db),
      request = command(returnAction(s, 1));
    const broken: Db = {
      ...db,
      run: (sql, ...args) => {
        if (sql.startsWith("INSERT INTO operations")) throw new Error("disk full");
        db.run(sql, ...args);
      },
    };
    expect(() => execute(broken, request, signal)).toThrow("disk full");
    expect(testState(db)).toEqual(before);
    expect(db.get("SELECT * FROM operations WHERE key=?", request.key)).toBeUndefined();
    const controller = new AbortController(),
      cancelled: Db = {
        ...db,
        run: (sql, ...args) => {
          db.run(sql, ...args);
          if (sql.startsWith("INSERT INTO return_lines")) controller.abort();
        },
      };
    expect(() => execute(cancelled, request, controller.signal)).toThrow(
      expect.objectContaining({ code: "E_CANCELLED" }),
    );
    expect(testState(db)).toEqual(before);
    expect(execute(db, request, signal).kind).toBe("ok");
    db.close();
    db = openVentasDatabase(dir);
    expect(execute(db, request, signal).kind).toBe("ok");
    expect(testState(db).returns).toHaveLength(1);
  });
  it("rejects stale corrections and aggregate overflow without leaving an unreadable ledger", () => {
    const p = setup(),
      cid = customer(),
      s = sell(p, 3, cid, 100),
      request = command(returnAction(s, 1));
    ok({
      type: "saveSettings",
      settings: { name: "Cambio", address: "", phone: "", thanks: "", banks: [] },
    });
    expect(execute(db, request, signal)).toMatchObject({
      kind: "rejected",
      issue: { code: "E_REVISION" },
    });
    const expected = snapshot(db).cash?.expected ?? 0;
    ok({ type: "closeCash", counted: expected, reason: "" });
    ok({ type: "openCash", initial: 0 });
    ok({
      type: "outflow",
      kind: "expense",
      concept: "Límite",
      category: "",
      payment: pay(9_000_000_000_000),
    });
    const before = testState(db);
    expect(run(returnAction(s, 3))).toMatchObject({ kind: "rejected", issue: { code: "E_LIMIT" } });
    expect(testState(db)).toEqual(before);
    expect(snapshotResultSchema.safeParse({ kind: "ok", value: snapshot(db) }).success).toBe(true);
  });
  it("keeps original ticket snapshots and initial bank after updates, deactivation and reversal", () => {
    const p = setup(),
      bid = bank(),
      cid = customer(),
      s = sell(p, 3, cid, 300, bid),
      before = detail(s),
      paymentId = before.initialPayment?.id ?? "";
    ok({
      type: "saveSettings",
      settings: {
        name: "Nuevo negocio",
        address: "",
        phone: "",
        thanks: "Nuevo gracias",
        banks: [],
      },
    });
    ok({
      type: "saveClient",
      client: { id: cid, name: "Nuevo cliente", phone: "", term: 1, limit: null },
    });
    ok({ type: "setActive", id: p, active: false });
    ok({ type: "reversePayment", paymentId, reason: "Error" });
    const after = detail(s);
    expect(after.sale).toEqual(before.sale);
    expect(after.initialPayment?.bankSnapshot).toEqual(before.initialPayment?.bankSnapshot);
    expect(after.initialPayment?.reversalId).toBeTruthy();
    expect(after.sale.initialPaymentId).toBe(paymentId);
    expect(after.balance.pending).toBe(300);
  });
});

describe("Ventas history and period queries", () => {
  it("accounts for returns and reversals by event date, including negative periods", () => {
    const p = setup(),
      s = sell(p);
    vi.setSystemTime(new Date("2026-11-08T05:59:59Z"));
    expect(summary()).toMatchObject({ revenue: 300, cogs: 100, profit: 200, received: 300 });
    vi.setSystemTime(new Date("2026-11-08T06:00:00Z"));
    ok(returnAction(s, 1));
    expect(summary("2026-11-08")).toMatchObject({
      revenue: -100,
      cogs: -33,
      profit: -67,
      received: -100,
      cash: -100,
    });
    expect(summary("2026-11-07")).toMatchObject({ revenue: 300, cogs: 100, received: 300 });
    const cid = customer();
    const later = sell(p, 1, cid, 100),
      paymentId = detail(later).initialPayment?.id ?? "";
    vi.setSystemTime(new Date("2026-11-09T18:00:00Z"));
    ok({ type: "reversePayment", paymentId, reason: "Captura" });
    expect(summary("2026-11-09")).toMatchObject({ revenue: 0, received: -100, cash: -100 });
  });
  it("separates abonos, purchases, expenses, withdrawals and losses from sales", () => {
    const p = setup(),
      cid = customer();
    sell(p, 2, cid, 0);
    ok({ type: "payAccount", clientId: cid, payment: pay(100) });
    ok({ type: "outflow", kind: "expense", concept: "Ruta", category: "", payment: pay(10) });
    ok({ type: "outflow", kind: "withdrawal", concept: "Retiro", category: "", payment: pay(20) });
    ok({ type: "adjust", productId: p, count: 0, reason: "Rotura", waste: true });
    expect(summary()).toMatchObject({
      revenue: 200,
      cogs: 67,
      expenses: 10,
      loss: 33,
      profit: 90,
      received: 100,
      purchases: 100,
      withdrawals: 20,
      balance: 100,
    });
  });
  it("paginates more than 1000 purchases while keeping snapshot compact and balances complete", () => {
    const cid = customer(),
      opening = ok({
        type: "openingBalance",
        clientId: cid,
        amount: 1,
        due: "2026-12-01",
        note: "Saldo previo",
      });
    db.transaction(() => {
      for (let n = 2; n <= 1005; n++)
        db.run(
          "INSERT INTO sales(id,folio,clientId,clientSnapshot,business,lines,total,term,due,exception,opening,note,received,change,at,date) SELECT ?,?,clientId,clientSnapshot,business,lines,total,term,due,exception,opening,note,received,change,at,date FROM sales WHERE id=?",
          randomUUID(),
          n,
          opening,
        );
      db.run("UPDATE sequences SET value=1005 WHERE name='sale'");
    });
    const compact = snapshot(db);
    expect("sales" in compact).toBe(false);
    expect("payments" in compact).toBe(false);
    expect("purchases" in (compact.accounts[0] ?? {})).toBe(false);
    expect(compact.accounts[0]?.balance).toBe(1005);
    expect(JSON.stringify(compact).length).toBeLessThan(10000);
    const first = historyPageSchema.parse(
        value("history", { kind: "sales", clientId: cid, limit: 50 }),
      ),
      second = historyPageSchema.parse(
        value("history", {
          kind: "sales",
          clientId: cid,
          limit: 50,
          offset: first.nextOffset,
          revision: first.revision,
        }),
      );
    expect(first.rows).toHaveLength(50);
    expect(second.rows).toHaveLength(50);
    expect(new Set([...first.rows, ...second.rows].map((r) => r.data.id)).size).toBe(100);
    const statement = statementSchema.parse(value("statement", { clientId: cid }));
    expect(statement.account.balance).toBe(1005);
    expect(statement.sales).toHaveLength(10);
    expect(statement.salesPage.total).toBe(1005);
    expect(summary().revenue).toBe(0);
    ok({ type: "setClientActive", id: cid, active: false });
    expect(
      query(db, "history", { kind: "sales", offset: 50, revision: first.revision }, signal),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_REVISION" } });
  });
  it("filters unicode names and literal wildcard characters with deterministic order", () => {
    const p = setup(100, 6, 100),
      cid = customer("El GÜERO %");
    sell(p, 1, cid, 0);
    sell(p, 1, null, 100);
    const result = historyPageSchema.parse(value("history", { kind: "sales", query: "güero" }));
    expect(result.rows).toHaveLength(1);
    expect(
      historyPageSchema.parse(value("history", { kind: "sales", query: "%" })).rows,
    ).toHaveLength(1);
    expect(
      query(db, "history", { kind: "sales", from: "2026-12-01", to: "2026-11-01" }, signal),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_PERIOD" } });
  });
  it("rejects overflowing summary without mutating or breaking compact snapshot", () => {
    const p = setup(9_000_000_000_000, 2, 0),
      bid = bank(),
      one = customer("Uno"),
      two = customer("Dos");
    sell(p, 1, one, 9_000_000_000_000, bid);
    sell(p, 1, two, 9_000_000_000_000, bid);
    const before = snapshot(db);
    expect(query(db, "summary", { from: "2026-11-07", to: "2026-11-07" }, signal)).toMatchObject({
      kind: "rejected",
      issue: { code: "E_LIMIT" },
    });
    expect(snapshot(db)).toEqual(before);
  });
  it("migrates initial payment links without relying on timestamps or current bank", () => {
    const legacy = mkdtempSync(join(tmpdir(), "ventas-before004-")),
      raw = new DatabaseSync(join(legacy, "ventas.db"));
    const saleId = randomUUID(),
      cid = randomUUID(),
      first = randomUUID(),
      second = randomUUID();
    raw.exec(
      "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,applied_at TEXT)",
    );
    for (const [version, name] of [
      [1, "inventory"],
      [2, "sales_accounts_cash"],
      [3, "outflow_reference"],
    ] as const) {
      raw.exec(
        readFileSync(
          new URL(
            `./db/migrations/${String(version).padStart(3, "0")}_${name}.sql`,
            import.meta.url,
          ),
          "utf8",
        ),
      );
      raw.prepare("INSERT INTO schema_migrations VALUES(?,?,?)").run(version, name, now);
    }
    raw.prepare("INSERT INTO clients VALUES(?,?,?,?,?,?)").run(cid, "Anterior", "", 15, null, 1);
    const business = JSON.stringify({
      name: "Anterior",
      address: "",
      phone: "",
      thanks: "Histórico",
      banks: [],
    });
    raw.prepare("INSERT INTO sales VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
      saleId,
      1,
      cid,
      JSON.stringify({
        id: cid,
        name: "Anterior",
        phone: "",
        term: 15,
        limit: null,
        active: true,
      }),
      business,
      "[]",
      200,
      15,
      "2026-11-22",
      "",
      0,
      "",
      100,
      0,
      now,
      "2026-11-07",
    );
    for (const [id, folio] of [
      [first, 1],
      [second, 2],
    ] as const) {
      raw
        .prepare("INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?)")
        .run(id, folio, cid, 100, "transfer", null, "null", "", null, now, "2026-11-07");
      raw.prepare("INSERT INTO payment_allocations VALUES(?,?,?)").run(id, saleId, 100);
    }
    raw.close();
    const migrated = openVentasDatabase(legacy);
    try {
      expect(
        migrated.get<{ initialPaymentId: string }>(
          "SELECT initialPaymentId FROM sales WHERE id=?",
          saleId,
        )?.initialPaymentId,
      ).toBe(first);
      expect(migrated.all("PRAGMA foreign_key_check")).toEqual([]);
    } finally {
      migrated.close();
      rmSync(legacy, { recursive: true, force: true });
    }
  });
});

it("reads each return's historical lines after distinct partial events and a total return", () => {
  const first = setup(100, 4, 100),
    second = ok({
      type: "saveProduct",
      product: {
        name: "Chocolate original",
        category: "Dulces",
        kind: "simple",
        unit: "piece",
        price: 200,
        minStock: 0,
      },
    });
  ok({ type: "receive", productId: second, qty: 3, cost: 100, method: "cash", bankId: null });
  const cid = customer();
  ok({
    type: "saveDraft",
    draft: {
      clientId: cid,
      lines: [
        { productId: first, qty: 2 },
        { productId: second, qty: 3 },
      ],
    },
  });
  const sid = ok({ type: "sell", expectedTotal: 800, payment: pay(800), exception: "" });
  const original = detail(sid).sale,
    a = original.lines.find((l) => l.productId === first),
    b = original.lines.find((l) => l.productId === second);
  if (!a || !b) throw new Error("Missing lines");
  const make = (items: { lineId: string; qty: number }[], restock: boolean, reason: string) =>
    ok({
      type: "returnSale",
      saleId: sid,
      items,
      restock,
      reason,
      refund: { method: "cash", bankId: null, reference: "DEV" },
    });
  const r1 = make([{ lineId: a.id, qty: 1 }], true, "Primer evento"),
    r2 = make([{ lineId: b.id, qty: 2 }], false, "Segundo evento"),
    r3 = make(
      [
        { lineId: a.id, qty: 1 },
        { lineId: b.id, qty: 1 },
      ],
      true,
      "Final total",
    );
  ok({
    type: "saveProduct",
    product: {
      id: first,
      name: "Nombre nuevo",
      category: "Otro",
      kind: "simple",
      unit: "piece",
      price: 999,
      minStock: 0,
    },
  });
  ok({ type: "setActive", id: second, active: false });
  const before = testState(db),
    read = (returnId: string) =>
      returnDetailSchema.parse(value("returnDetail", { returnId, limit: 20 }));
  expect(read(r1)).toMatchObject({
    record: { reason: "Primer evento", restock: true, amount: 100, cost: 25 },
    saleFolio: original.folio,
    lines: {
      total: 1,
      rows: [
        {
          lineId: a.id,
          productId: first,
          name: "Gomitas",
          qty: 1,
          amount: 100,
          cost: 25,
          price: 100,
        },
      ],
    },
  });
  expect(read(r2)).toMatchObject({
    record: { reason: "Segundo evento", restock: false, amount: 400, cost: 67 },
    lines: { rows: [{ lineId: b.id, name: "Chocolate original", qty: 2, amount: 400, cost: 67 }] },
  });
  expect(read(r3).lines.rows).toHaveLength(2);
  expect(detail(sid).balance).toMatchObject({ total: 0, paid: 0, pending: 0 });
  expect(
    historyPageSchema.parse(value("history", { kind: "returns", saleId: sid })).rows,
  ).toHaveLength(3);
  expect(statementSchema.parse(value("statement", { clientId: cid })).returns.total).toBe(3);
  expect(testState(db)).toEqual(before);
  expect(snapshot(db)).not.toHaveProperty("returns");
});
it("paginates return lines with stable UUID order, revision checks, and a fifty-line cap", () => {
  const first = setup(100, 60, 600),
    sid = sell(first, 55, null, 5500),
    s = detail(sid).sale,
    l = s.lines[0];
  if (!l) throw new Error("Missing line");
  // Model an original multi-line sale without issuing dozens of unrelated catalog writes.
  const lines = Array.from({ length: 55 }, (_, n) => ({
    ...l,
    id: randomUUID(),
    qty: 1,
    cost: 10,
    name: `Original ${n}`,
  }));
  db.run("UPDATE sales SET lines=? WHERE id=?", JSON.stringify(lines), sid);
  const rid = ok({
    type: "returnSale",
    saleId: sid,
    items: lines.map((l) => ({ lineId: l.id, qty: 1 })),
    restock: true,
    reason: "55 líneas",
    refund: { method: "cash", bankId: null, reference: "" },
  });
  const revision = snapshot(db).revision,
    read = (offset: number) =>
      returnDetailSchema.parse(
        value("returnDetail", { returnId: rid, revision, offset, limit: 20 }),
      );
  const pages = [read(0), read(20), read(40)];
  expect(pages.map((p) => p.lines.rows.length)).toEqual([20, 20, 15]);
  expect(pages.map((p) => p.lines.nextOffset)).toEqual([20, 40, null]);
  expect(pages[0]?.lines.total).toBe(55);
  expect(pages.flatMap((p) => p.lines.rows.map((l) => l.lineId))).toEqual(
    lines.map((l) => l.id).sort(),
  );
  expect(read(60).lines.rows).toEqual([]);
  expect(
    query(db, "returnDetail", { returnId: rid, revision: revision - 1 }, signal),
  ).toMatchObject({ kind: "rejected", issue: { code: "E_REVISION" } });
  expect(query(db, "returnDetail", { returnId: randomUUID() }, signal)).toMatchObject({
    kind: "rejected",
    issue: { code: "E_NOT_FOUND" },
  });
  expect(() => value("returnDetail", { returnId: rid, limit: 51 })).toThrow("Invalid return query");
});
