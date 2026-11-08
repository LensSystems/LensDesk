import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays } from "../shared/calendar.ts";
import type { Action, MutationResult } from "../shared/contracts.ts";
import type { PaymentInput } from "../shared/trading-contracts.ts";
import { type Db, openVentasDatabase } from "./db/driver.ts";
import { bounded, operationalDate } from "./domain.ts";
import { execute, snapshot } from "./service.ts";

let dir: string, db: Db;
const signal = new AbortController().signal;
const now = "2026-11-07T18:00:00.000Z";
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));
  dir = mkdtempSync(join(tmpdir(), "ventas-trading-"));
  db = openVentasDatabase(dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
  vi.useRealTimers();
});
const request = (action: Action, key = randomUUID(), revision = snapshot(db).revision) => ({
  key,
  revision,
  action,
});
const run = (action: Action) => execute(db, request(action), signal);
function id(result: MutationResult) {
  if (result.kind !== "ok") throw new Error(result.issue.code);
  return result.value.id;
}
function cash(initial = 10000) {
  if (!snapshot(db).cash) id(run({ type: "openCash", initial }));
}
function customer(overrides: Partial<Extract<Action, { type: "saveClient" }>["client"]> = {}) {
  return id(
    run({
      type: "saveClient",
      client: {
        name: `Cliente ${snapshot(db).clients.length}`,
        phone: "",
        term: 7,
        limit: null,
        ...overrides,
      },
    }),
  );
}
function product(price = 1000, qty = 20, cost = 1000) {
  cash();
  const pid = id(
    run({
      type: "saveProduct",
      product: {
        name: `Producto ${snapshot(db).products.length}`,
        category: "Dulces",
        kind: "simple",
        unit: "piece",
        price,
        minStock: 0,
      },
    }),
  );
  id(run({ type: "receive", productId: pid, qty, cost, method: "cash", bankId: null }));
  return pid;
}
function draft(pid: string, clientId: string | null = null, qty = 1) {
  return id(run({ type: "saveDraft", draft: { clientId, lines: [{ productId: pid, qty }] } }));
}
const payment = (amount: number, extra: Partial<PaymentInput> = {}): PaymentInput => ({
  amount,
  received: amount,
  method: "cash",
  bankId: null,
  reference: "",
  ...extra,
});
function sell(total: number, amount = total, exception = "") {
  return run({ type: "sell", expectedTotal: total, payment: payment(amount), exception });
}
function bank() {
  const bankId = randomUUID();
  id(
    run({
      type: "saveSettings",
      settings: {
        name: "Tienda Original",
        address: "Calle 1",
        phone: "123",
        thanks: "Gracias",
        banks: [
          { id: bankId, bank: "Banco Original", holder: "Titular", clabe: "012345678901234567" },
        ],
      },
    }),
  );
  return bankId;
}

describe("Ventas trading", () => {
  it("migrates 001 preserving UUIDs, stock, operation keys and unassigned historical purchases", () => {
    const fsDir = mkdtempSync(join(tmpdir(), "ventas-legacy-"));
    const raw = new DatabaseSync(join(fsDir, "ventas.db"));
    const pid = randomUUID(),
      key = randomUUID(),
      purchaseId = randomUUID(),
      moveId = randomUUID();
    const action: Action = {
      type: "saveSettings",
      settings: { name: "Anterior", address: "", phone: "", thanks: "", banks: [] },
    };
    raw.exec(readFileSync(new URL("./db/migrations/001_inventory.sql", import.meta.url), "utf8"));
    raw.exec(
      "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL); INSERT INTO schema_migrations VALUES(1,'inventory','2026-01-01T00:00:00Z')",
    );
    raw
      .prepare("INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(pid, "Histórico", "Dulces", "simple", "piece", 1000, 0, 4, 399, 399, 4, 1);
    raw
      .prepare("INSERT INTO purchases VALUES(?,?,?,?,?,?,?,?)")
      .run(purchaseId, pid, 4, 399, "cash", null, now, "2026-11-07");
    raw
      .prepare("INSERT INTO movements VALUES(?,?,?,?,?,?,?,?,?)")
      .run(moveId, pid, 4, 399, "purchase", purchaseId, "", now, "2026-11-07");
    const result = { kind: "ok", value: { id: randomUUID(), revision: 1 } };
    raw
      .prepare("INSERT INTO operations VALUES(?,?,?)")
      .run(key, JSON.stringify(action), JSON.stringify(result));
    raw.close();
    const migrated = openVentasDatabase(fsDir);
    try {
      const data = snapshot(migrated);
      expect(data.products[0]).toMatchObject({ id: pid, stock: 4, value: 399 });
      expect(data.movements[0]?.id).toBe(moveId);
      expect(data.purchases[0]).toMatchObject({ id: purchaseId, cashId: null, bankSnapshot: null });
      expect(execute(migrated, { key, revision: 0, action }, signal)).toEqual(result);
      expect(migrated.all("SELECT * FROM schema_migrations")).toHaveLength(3);
      expect(data.cash).toBeNull();
    } finally {
      migrated.close();
      rmSync(fsDir, { recursive: true, force: true });
    }
  });
  it("persists draft without consuming stock and completes a single atomic cash sale", () => {
    const pid = product(1234, 3, 100);
    draft(pid, null, 2);
    expect(snapshot(db).products[0]?.stock).toBe(3);
    db.close();
    db = openVentasDatabase(dir);
    expect(snapshot(db).draft.lines).toEqual([{ productId: pid, qty: 2 }]);
    const req = request({
      type: "sell",
      expectedTotal: 2468,
      payment: payment(2468, { received: 3000 }),
      exception: "",
    });
    const first = execute(db, req, signal);
    expect(first.kind).toBe("ok");
    expect(execute(db, req, signal)).toEqual(first);
    const data = snapshot(db);
    expect(data.sales).toHaveLength(1);
    expect(data.sales[0]).toMatchObject({
      folio: 1,
      total: 2468,
      received: 3000,
      change: 532,
      lines: [{ qty: 2, cost: 67 }],
    });
    expect(data.products[0]).toMatchObject({ stock: 1, value: 33 });
    expect(data.payments[0]?.allocations).toEqual([{ saleId: id(first), amount: 2468 }]);
    expect(data.draft.lines).toEqual([]);
    expect(data.cash).toMatchObject({ ins: 2468, purchases: 100, expected: 12368 });
  });
  it("rolls back inventory, payment, folio, draft and idempotency after a disk failure", () => {
    const pid = product();
    draft(pid);
    const before = snapshot(db),
      req = request({ type: "sell", expectedTotal: 1000, payment: payment(1000), exception: "" });
    const failing: Db = {
      ...db,
      run: (sql, ...values) => {
        if (sql.startsWith("INSERT INTO operations")) throw new Error("disk full");
        db.run(sql, ...values);
      },
    };
    expect(() => execute(failing, req, signal)).toThrow("disk full");
    expect(snapshot(db)).toEqual(before);
    expect(db.get("SELECT * FROM operations WHERE key=?", req.key)).toBeUndefined();
    expect(id(execute(db, req, signal))).toBeTruthy();
    expect(snapshot(db).sales[0]?.folio).toBe(1);
  });
  it("keeps a failed cart and rejects partial counter sale and changed total", () => {
    const pid = product();
    draft(pid);
    const before = snapshot(db);
    expect(sell(1000, 500)).toMatchObject({ kind: "rejected", issue: { code: "E_PAYMENT" } });
    expect(sell(999)).toMatchObject({ kind: "rejected", issue: { code: "E_TOTAL" } });
    expect(snapshot(db)).toEqual(before);
  });
  it("creates per-purchase credit dates and applies FIFO after restart without renewing old debt", () => {
    const cid = customer(),
      pid = product();
    draft(pid, cid);
    const first = id(sell(1000, 200));
    vi.setSystemTime(new Date("2026-11-10T18:00:00Z"));
    id(
      run({
        type: "saveClient",
        client: { id: cid, name: "Cliente 0", phone: "", term: 30, limit: null },
      }),
    );
    draft(pid, cid);
    const second = id(sell(1000, 0));
    db.close();
    db = openVentasDatabase(dir);
    id(run({ type: "payAccount", clientId: cid, payment: payment(1000) }));
    const data = snapshot(db),
      a = data.accounts[0];
    expect(data.sales.map((s) => s.due)).toEqual(["2026-11-14", "2026-12-10"]);
    expect(data.payments.at(-1)?.allocations).toEqual([
      { saleId: first, amount: 800 },
      { saleId: second, amount: 200 },
    ]);
    expect(a).toMatchObject({ balance: 800, totalPaid: 1200 });
    vi.setSystemTime(new Date("2026-12-11T18:00:00Z"));
    draft(pid, cid);
    const before = snapshot(db);
    expect(sell(1000, 0)).toMatchObject({ kind: "rejected", issue: { code: "E_CREDIT" } });
    expect(snapshot(db)).toEqual(before);
    id(sell(1000, 0, "Acuerdo con cliente"));
    expect(snapshot(db).sales.at(-1)?.exception).toBe("Acuerdo con cliente");
    expect(snapshot(db).sales[1]?.due).toBe("2026-12-10");
  });
  it("enforces credit limit, allows repayment when inactive, rejects overpayment and permits another purchase", () => {
    const cid = customer({ limit: 1000 }),
      pid = product();
    draft(pid, cid);
    id(sell(1000, 0));
    draft(pid, cid);
    expect(sell(1000, 0)).toMatchObject({ kind: "rejected", issue: { code: "E_CREDIT" } });
    id(run({ type: "setClientActive", id: cid, active: false }));
    expect(sell(1000)).toMatchObject({ kind: "rejected", issue: { code: "E_CLIENT" } });
    expect(run({ type: "payAccount", clientId: cid, payment: payment(1001) })).toMatchObject({
      kind: "rejected",
      issue: { code: "E_BALANCE" },
    });
    id(run({ type: "payAccount", clientId: cid, payment: payment(1000) }));
    expect(snapshot(db).accounts[0]?.balance).toBe(0);
    id(run({ type: "setClientActive", id: cid, active: true }));
    id(sell(1000, 0));
    expect(snapshot(db).accounts[0]?.balance).toBe(1000);
  });
  it("validates one payment method, received amounts and snapshots selected bank and business", () => {
    const bankId = bank(),
      pid = product(),
      cid = customer();
    draft(pid, cid);
    expect(
      run({
        type: "sell",
        expectedTotal: 1000,
        payment: payment(500, { method: "transfer", bankId, received: 501 }),
        exception: "",
      }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_PAYMENT" } });
    expect(
      run({
        type: "sell",
        expectedTotal: 1000,
        payment: payment(500, { received: 499 }),
        exception: "",
      }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_PAYMENT" } });
    id(
      run({
        type: "sell",
        expectedTotal: 1000,
        payment: payment(500, { method: "transfer", bankId, reference: "REF-1" }),
        exception: "",
      }),
    );
    const before = snapshot(db);
    id(
      run({
        type: "saveSettings",
        settings: { name: "Nueva tienda", address: "", phone: "", thanks: "", banks: [] },
      }),
    );
    id(
      run({
        type: "saveClient",
        client: { id: cid, name: "Otro nombre", phone: "", term: 1, limit: null },
      }),
    );
    id(
      run({
        type: "saveProduct",
        product: {
          id: pid,
          name: "Otro producto",
          category: "Otra",
          kind: "simple",
          unit: "piece",
          price: 2500,
          minStock: 0,
        },
      }),
    );
    const after = snapshot(db);
    expect(after.sales).toEqual(before.sales);
    expect(after.payments).toEqual(before.payments);
    expect(after.payments[0]?.bankSnapshot?.bank).toBe("Banco Original");
    expect(after.sales[0]?.business.name).toBe("Tienda Original");
    expect(after.cash?.ins).toBe(0);
  });
  it("requires cash for new purchases and outflows, preserves sessions and explains closing difference", () => {
    const bankId = bank();
    const pid = id(
      run({
        type: "saveProduct",
        product: {
          name: "P",
          category: "C",
          kind: "simple",
          unit: "piece",
          price: 100,
          minStock: 0,
        },
      }),
    );
    expect(
      run({ type: "receive", productId: pid, qty: 1, cost: 100, method: "cash", bankId: null }),
    ).toMatchObject({ kind: "rejected", issue: { code: "E_CASH_CLOSED" } });
    cash(1000);
    const cashId = snapshot(db).cash?.id;
    id(run({ type: "receive", productId: pid, qty: 1, cost: 100, method: "cash", bankId: null }));
    id(
      run({
        type: "outflow",
        kind: "expense",
        concept: "Pasaje",
        category: "Transporte",
        payment: payment(200),
      }),
    );
    id(
      run({
        type: "outflow",
        kind: "withdrawal",
        concept: "Retiro",
        category: "",
        payment: payment(50),
      }),
    );
    id(
      run({
        type: "outflow",
        kind: "expense",
        concept: "Luz",
        category: "Servicios",
        payment: payment(300, { method: "transfer", bankId }),
      }),
    );
    expect(snapshot(db).cash).toMatchObject({
      purchases: 100,
      expenses: 200,
      withdrawals: 50,
      outs: 350,
      expected: 650,
    });
    expect(run({ type: "closeCash", counted: 640, reason: "" })).toMatchObject({
      kind: "rejected",
      issue: { code: "E_CASH_DIFFERENCE" },
    });
    id(run({ type: "closeCash", counted: 640, reason: "Faltante" }));
    cash(100);
    expect(snapshot(db).cash?.id).not.toBe(cashId);
    expect(snapshot(db).cash?.outs).toBe(0);
    expect(snapshot(db).closings[0]).toMatchObject({
      id: cashId,
      expected: 650,
      counted: 640,
      difference: -10,
      reason: "Faltante",
    });
  });
  it("records explicitly identified opening debt without stock, fake lines or cash income", () => {
    const cid = customer();
    id(
      run({
        type: "openingBalance",
        clientId: cid,
        amount: 10000,
        due: "2026-10-20",
        note: "Saldo anterior entregado por cliente",
      }),
    );
    const data = snapshot(db);
    expect(data.sales[0]).toMatchObject({
      opening: true,
      lines: [],
      total: 10000,
      note: "Saldo anterior entregado por cliente",
    });
    expect(data.accounts[0]).toMatchObject({ balance: 10000, overdue: 10000 });
    expect(data.payments).toEqual([]);
    expect(data.movements).toEqual([]);
    expect(data.cash).toBeNull();
  });
  it("keeps stale concurrent operations and overflowing sale arithmetic fully atomic", () => {
    const pid = product(9_000_000_000_000, 2, 100);
    draft(pid, null, 2);
    const before = snapshot(db);
    expect(sell(9_000_000_000_000)).toMatchObject({ kind: "rejected", issue: { code: "E_LIMIT" } });
    expect(snapshot(db)).toEqual(before);
    const second = openVentasDatabase(dir);
    try {
      const stale = request({ type: "openCash", initial: 0 });
      id(
        run({
          type: "saveSettings",
          settings: { name: "Cambio", address: "", phone: "", thanks: "", banks: [] },
        }),
      );
      expect(execute(second, stale, signal)).toMatchObject({
        kind: "rejected",
        issue: { code: "E_REVISION" },
      });
    } finally {
      second.close();
    }
    expect(() => bounded(9_000_000_000_001n)).toThrow();
  });
  it("rolls back earlier cart lines when a later item is no longer available", () => {
    const first = product(1000, 3, 300),
      second = product(1000, 1, 100);
    id(
      run({
        type: "saveDraft",
        draft: {
          clientId: null,
          lines: [
            { productId: first, qty: 1 },
            { productId: second, qty: 1 },
          ],
        },
      }),
    );
    id(run({ type: "adjust", productId: second, count: 0, reason: "Rotura", waste: true }));
    const before = snapshot(db);
    expect(sell(2000)).toMatchObject({ kind: "rejected", issue: { code: "E_STOCK" } });
    expect(snapshot(db)).toEqual(before);
  });
  it("cancels after stock and draft mutations and rolls the entire transaction back", () => {
    const pid = product();
    draft(pid);
    const before = snapshot(db),
      controller = new AbortController();
    const proxy: Db = {
      ...db,
      run: (sql, ...args) => {
        db.run(sql, ...args);
        if (sql === "DELETE FROM draft_lines") controller.abort();
      },
    };
    expect(() =>
      execute(
        proxy,
        request({ type: "sell", expectedTotal: 1000, payment: payment(1000), exception: "" }),
        controller.signal,
      ),
    ).toThrow(expect.objectContaining({ code: "E_CANCELLED" }));
    expect(snapshot(db)).toEqual(before);
  });
  it("allocates against accounts beyond the 1000 inventory-history display bound", () => {
    const cid = customer();
    id(
      run({
        type: "openingBalance",
        clientId: cid,
        amount: 1,
        due: "2026-11-07",
        note: "Prior balance",
      }),
    );
    const original = db.get<{ id: string }>("SELECT id FROM sales");
    if (!original) throw new Error("Missing sale fixture");
    db.transaction(() => {
      for (let n = 2; n <= 1002; n++)
        db.run(
          "INSERT INTO sales SELECT ?,?,clientId,clientSnapshot,business,lines,total,term,due,exception,opening,note,received,change,at,date FROM sales WHERE id=?",
          randomUUID(),
          n,
          original.id,
        );
      db.run("UPDATE sequences SET value=1002 WHERE name='sale'");
    });
    cash();
    expect(snapshot(db).accounts[0]?.balance).toBe(1002);
    id(run({ type: "payAccount", clientId: cid, payment: payment(1002) }));
    const data = snapshot(db);
    expect(data.accounts[0]?.balance).toBe(0);
    expect(data.payments[0]?.allocations).toHaveLength(1002);
  });
  it("calculates calendar days across leap/month/year and Mexico operational midnight", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 30)).toBe("2027-01-30");
    expect(operationalDate("2026-11-08T05:59:59Z")).toBe("2026-11-07");
    expect(operationalDate("2026-11-08T06:00:00Z")).toBe("2026-11-08");
    expect(() =>
      run({ type: "saveClient", client: { name: "Malo", phone: "", term: 0, limit: null } }),
    ).toThrow(expect.objectContaining({ code: "E_INVALID_PARAMS" }));
  });
});
