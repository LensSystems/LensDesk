import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import type { Command } from "../shared/contracts.ts";
import type { HistoryPage, HistoryRow, SaleDetail, Summary } from "../shared/history-contracts.ts";
import type { PaymentRecord, SaleRecord } from "../shared/trading-contracts.ts";
import { fixture, pid } from "./ui-fixture.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: "es",
    fallbackLng: "es",
    interpolation: { escapeValue: false },
  });
});
beforeEach(async () => {
  await i18n.changeLanguage("es");
});
const cid = "9d44e2be-d3d6-4d73-ad57-65011a4a12d1",
  paymentId = "9d44e2be-d3d6-4d73-ad57-65011a4a12d2",
  bankId = "9d44e2be-d3d6-4d73-ad57-65011a4a12d3";
function seeded() {
  const f = fixture(),
    client = { id: cid, name: "Cliente histórico", phone: "", term: 15, limit: null, active: true },
    bank = {
      id: bankId,
      bank: "Banco histórico",
      holder: "Titular histórico",
      clabe: "012345678901234567",
    };
  f.data.clients.push({ ...client, name: "Cliente actual" });
  f.data.accounts.push({ clientId: cid, balance: 0, overdue: 0, nextDue: null, totalPaid: 100 });
  f.data.settings = {
    name: "Negocio actual",
    address: "Nueva dirección",
    phone: "",
    thanks: "Gracias actual",
    banks: [],
  };
  const sale: SaleRecord = {
    id: pid,
    folio: 1,
    clientId: cid,
    clientSnapshot: client,
    business: {
      name: "Negocio histórico",
      address: "Dirección original",
      phone: "123",
      thanks: "Gracias histórico",
      banks: [bank],
    },
    lines: Array.from({ length: 50 }, (_, i) => ({
      id: `7cfa5450-9380-4d25-8a00-${String(i).padStart(12, "0")}`,
      productId: crypto.randomUUID(),
      name: `Producto histórico ${i + 1}`,
      qty: 1,
      price: 2,
      cost: 1,
    })),
    total: 100,
    term: 15,
    due: "2026-11-22",
    exception: "",
    opening: false,
    note: "",
    received: 100,
    change: 0,
    at: "2026-11-07T18:00:00Z",
    date: "2026-11-07",
    initialPaymentId: paymentId,
  };
  const payment: PaymentRecord = {
    id: paymentId,
    folio: 1,
    clientId: cid,
    amount: 100,
    method: "transfer",
    bankId,
    bankSnapshot: bank,
    reference: "ORIGINAL",
    cashId: null,
    at: sale.at,
    date: sale.date,
    allocations: [{ saleId: pid, amount: 100 }],
    opening: false,
    reversalId: null,
  };
  const empty: HistoryPage = { revision: 0, total: 0, nextOffset: null, rows: [] };
  const { allocations: _allocations, ...paymentSummary } = payment;
  const detail: SaleDetail = {
    revision: 0,
    sale,
    balance: { saleId: pid, total: 100, paid: 100, pending: 0, due: sale.due },
    initialPayment: payment,
    returned: [],
    payments: {
      revision: 0,
      total: 1,
      nextOffset: null,
      rows: [{ kind: "payment", data: { ...paymentSummary, reversal: null, applied: 100 } }],
    },
    returns: empty,
  };
  f.details[pid] = detail;
  const row: HistoryRow = {
    kind: "sale",
    data: {
      id: pid,
      folio: 1,
      clientId: cid,
      clientName: client.name,
      date: sale.date,
      due: sale.due,
      total: 100,
      net: 100,
      paid: 100,
      pending: 0,
      opening: false,
      note: "",
    },
  };
  f.rows.push(row);
  return { ...f, detail, row };
}
async function tickets(f: ReturnType<typeof seeded>) {
  f.mount();
  await screen.findByText(es.emptyCatalog);
  fireEvent.click(
    within(screen.getByRole("navigation")).getByRole("button", { name: es.nav.tickets }),
  );
  await screen.findByRole("article", { name: es.saleTicket });
}

describe("Ventas tickets and summary", () => {
  it("shows a long original ticket with historical client, business, bank and thanks", async () => {
    const f = seeded();
    await tickets(f);
    const ticket = screen.getByRole("article", { name: es.saleTicket });
    expect(within(ticket).getByText("Negocio histórico")).toBeInTheDocument();
    expect(within(ticket).getByText(/Cliente histórico/)).toBeInTheDocument();
    expect(within(ticket).getByText("Producto histórico 50")).toBeInTheDocument();
    expect(within(ticket).getByText(/Banco histórico/)).toBeInTheDocument();
    expect(within(ticket).getByText("Gracias histórico")).toBeInTheDocument();
    expect(within(ticket).queryByText("Negocio actual")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /PDF|Imprimir/ })).not.toBeInTheDocument();
  });
  it("paginates and filters tickets without shipping the full history in snapshot", async () => {
    const f = seeded();
    for (let n = 2; n <= 45; n++)
      f.rows.push({
        kind: "sale",
        data: { ...f.row.data, id: crypto.randomUUID(), folio: n, clientName: `Cliente ${n}` },
      } as HistoryRow);
    await tickets(f);
    const list = screen.getByRole("complementary");
    expect(within(list).getAllByRole("button", { name: /V-\d/ })).toHaveLength(20);
    fireEvent.click(within(list).getByRole("button", { name: es.nextPage }));
    await waitFor(() => expect(within(list).getByText(/21–40 de 45/)).toBeInTheDocument());
    fireEvent.change(within(list).getByLabelText(es.searchHistory), {
      target: { value: "Cliente 45" },
    });
    await waitFor(() =>
      expect(within(list).getAllByRole("button", { name: /V-\d/ })).toHaveLength(1),
    );
    expect(within(list).getByText(/1–1 de 1/)).toBeInTheDocument();
    expect("sales" in f.data).toBe(false);
    expect("payments" in f.data).toBe(false);
  });
  it("keeps return errors and snapshot recovery reachable within its modal", async () => {
    const f = seeded();
    const detail = f.details[pid];
    if (!detail) throw new Error("Missing detail");
    detail.balance = { ...detail.balance, paid: 0, pending: 100 };
    await tickets(f);
    fireEvent.click(screen.getByRole("button", { name: es.returnOrCancel }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("spinbutton")).toHaveLength(50);
    fireEvent.change(within(dialog).getByLabelText(es.reason), {
      target: { value: "Producto dañado" },
    });
    f.invoke
      .mockResolvedValueOnce({ kind: "rejected", issue: { code: "E_RETURN" } })
      .mockRejectedValueOnce(new Error("snapshot failed"));
    fireEvent.click(within(dialog).getByRole("button", { name: es.confirmReturn }));
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(es.errors.E_RELOAD_REQUIRED),
    );
    expect(within(dialog).getByRole("button", { name: es.confirmReturn })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: es.retry }));
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: es.confirmReturn })).toBeEnabled(),
    );
    expect(within(dialog).getByLabelText(es.reason)).toHaveValue("Producto dañado");
    const command = f.invoke.mock.calls.find(([method]) => method === "execute")?.[1] as Command;
    expect(command.action.type).toBe("returnSale");
  });
  it("offers explicit reversal confirmation with reason and preserves original receipt bank", async () => {
    const f = seeded();
    await tickets(f);
    fireEvent.click(screen.getByRole("button", { name: es.reversePayment }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(es.reason), {
      target: { value: "Pago duplicado" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: es.confirmReversal }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(f.invoke).toHaveBeenCalledWith(
      "execute",
      expect.objectContaining({
        action: { type: "reversePayment", paymentId, reason: "Pago duplicado" },
      }),
    );
  });
  it("ignores a late history response after the user changes its search", async () => {
    const f = seeded(),
      invoke = f.invoke.getMockImplementation();
    if (!invoke) throw new Error("Missing fixture");
    let release: (value: unknown) => void = () => {};
    let first = true;
    f.invoke.mockImplementation(async (method, params) => {
      if (method === "history" && first) {
        first = false;
        return new Promise((resolve) => {
          release = resolve;
        });
      }
      return invoke(method, params);
    });
    f.mount();
    await screen.findByText(es.emptyCatalog);
    fireEvent.click(
      within(screen.getByRole("navigation")).getByRole("button", { name: es.nav.tickets }),
    );
    fireEvent.change(screen.getByLabelText(es.searchHistory), { target: { value: "No existe" } });
    expect(await screen.findByText(es.noConfirmedSales)).toBeInTheDocument();
    await act(async () =>
      release({ kind: "ok", value: { revision: 0, total: 1, nextOffset: null, rows: [f.row] } }),
    );
    expect(screen.queryByRole("button", { name: /V-000001/ })).not.toBeInTheDocument();
  });
  it("shows negative-period metrics and recovers a typed query overflow without altering snapshot", async () => {
    const f = seeded(),
      invoke = f.invoke.getMockImplementation();
    if (!invoke) throw new Error("Missing fixture");
    let first = true;
    const result: Summary = {
      from: "2026-11-07",
      to: "2026-11-07",
      revenue: -100,
      cogs: -33,
      expenses: 0,
      loss: 0,
      profit: -67,
      received: -100,
      cash: -100,
      transfer: 0,
      purchases: 0,
      withdrawals: 0,
      balance: 0,
      overdue: 0,
      count: 0,
      top: [],
    };
    f.invoke.mockImplementation(async (method, params) => {
      if (method !== "summary") return invoke(method, params);
      if (first) {
        first = false;
        return { kind: "rejected", issue: { code: "E_LIMIT" } };
      }
      return { kind: "ok", value: result };
    });
    f.mount();
    await screen.findByText(es.emptyCatalog);
    fireEvent.click(
      within(screen.getByRole("navigation")).getByRole("button", { name: es.nav.summary }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(es.errors.E_LIMIT);
    fireEvent.click(screen.getByRole("button", { name: es.retry }));
    await waitFor(() => expect(screen.getAllByText("-$1.00").length).toBeGreaterThan(0));
    expect(screen.getAllByText("-$0.67").length).toBeGreaterThan(0);
    expect(f.data.revision).toBe(0);
  });
});
