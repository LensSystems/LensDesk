import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, expect, it } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import type { SaleDetail } from "../shared/history-contracts.ts";
import { fixture, pid } from "./ui-fixture.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: "es",
    interpolation: { escapeValue: false },
  });
});
beforeEach(async () => {
  await i18n.changeLanguage("es");
});
const cid = "00000000-0000-4000-8000-000000000001";
const bid = "00000000-0000-4000-8000-000000000002";
const saved = "00000000-0000-4000-8000-000000000003";
function seeded() {
  const f = fixture();
  f.data.products.push({
    id: pid,
    name: "Concha",
    category: "Pan",
    kind: "simple",
    unit: "piece",
    price: 800,
    minStock: 5,
    stock: 10,
    value: 5000,
    lastValue: 5000,
    lastQty: 10,
    active: true,
    icon: "cookie",
  });
  f.data.clients.push({ id: cid, name: "Lupe", phone: "", term: 15, limit: null, active: true });
  f.data.accounts.push({
    clientId: cid,
    balance: 25000,
    overdue: 10000,
    nextDue: "2026-11-17",
    totalPaid: 10000,
  });
  f.data.settings.banks.push({
    id: bid,
    bank: "Banco elegido",
    holder: "Lupe",
    clabe: "012345678901234567",
    alias: "Elegida",
  });
  f.data.settings.defaultBankId = bid;
  f.data.cash = {
    id: crypto.randomUUID(),
    initial: 0,
    ins: 0,
    purchases: 0,
    expenses: 0,
    withdrawals: 0,
    outs: 0,
    refunds: 0,
    reversals: 0,
    expected: 0,
    at: "2026-11-07T18:00:00Z",
    date: f.data.today,
  };
  f.data.draft = { clientId: cid, lines: [{ productId: pid, qty: 1 }] };
  const page = { revision: 0, rows: [], total: 0, nextOffset: null };
  const detail: SaleDetail = {
    revision: 0,
    sale: {
      id: saved,
      folio: 77,
      clientId: cid,
      clientSnapshot: f.data.clients[0] ?? null,
      business: f.data.settings,
      lines: [
        {
          id: crypto.randomUUID(),
          productId: pid,
          name: "Concha confirmada exacta",
          qty: 1,
          price: 800,
          cost: 500,
        },
      ],
      total: 800,
      term: 15,
      due: "2026-11-22",
      exception: "",
      opening: false,
      note: "",
      received: 800,
      change: 0,
      at: "2026-11-07T18:00:00Z",
      date: f.data.today,
      initialPaymentId: null,
    },
    balance: { saleId: saved, total: 800, paid: 800, pending: 0, due: "2026-11-22" },
    initialPayment: null,
    returned: [],
    payments: page,
    returns: page,
  };
  f.details[saved] = detail;
  f.details[pid] = {
    ...detail,
    sale: {
      ...detail.sale,
      id: pid,
      folio: 999,
      lines: detail.sale.lines.map((line) => ({ ...line, name: "Venta ajena" })),
    },
    balance: { ...detail.balance, saleId: pid },
  };
  f.rows.push({
    kind: "sale",
    data: {
      id: pid,
      folio: 999,
      clientId: cid,
      clientName: "Otra venta",
      date: f.data.today,
      due: "2026-11-22",
      total: 800,
      net: 800,
      paid: 800,
      pending: 0,
      opening: false,
      note: "",
    },
  });
  const invoke = f.invoke.getMockImplementation();
  if (!invoke) throw Error("fixture");
  f.invoke.mockImplementation(async (method, params) => {
    const result = await invoke(method, params);
    if (method === "execute" && (params as { action: { type: string } }).action.type === "sell")
      return { kind: "ok", value: { id: saved, revision: f.data.revision } };
    return result;
  });
  return f;
}
async function mount() {
  const f = seeded();
  f.mount();
  await screen.findByRole("button", { name: "Agregar Concha" });
  return f;
}
const tab = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }));
async function open() {
  const f = await mount();
  fireEvent.keyDown(document, { key: "F10" });
  await screen.findByRole("heading", { name: es.checkoutWorkspace });
  return f;
}
it("opens the shared Tickets workspace with F10 without selling and returns the persisted draft and focus", async () => {
  const f = await open();
  expect(screen.getByRole("tab", { name: es.nav.tickets })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(0);
  expect(screen.getByRole("article", { name: es.draftTicket })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: es.backToSale }));
  await waitFor(() =>
    expect(screen.getByRole("searchbox", { name: es.searchProduct })).toHaveFocus(),
  );
  expect(f.data.draft.lines).toEqual([{ productId: pid, qty: 1 }]);
});
it("preserves edited checkout fields and independent statement bank/client across navigation and settings changes", async () => {
  const f = await open();
  fireEvent.change(screen.getByLabelText(es.checkoutAppliedPayment), { target: { value: "4.00" } });
  fireEvent.change(screen.getByLabelText(es.checkoutReceivedCash), { target: { value: "10.00" } });
  tab(es.nav.sale);
  f.data.settings.defaultBankId = null;
  fireEvent.click(screen.getByRole("button", { name: "Agregar Concha" }));
  await waitFor(() => expect(f.data.draft.lines[0]?.qty).toBe(2));
  await waitFor(() => expect(screen.getByRole("button", { name: es.checkout })).toBeEnabled());
  tab(es.nav.tickets);
  expect(screen.getByLabelText(es.checkoutAppliedPayment)).toHaveValue("4.00");
  expect(screen.getByLabelText(es.checkoutReceivedCash)).toHaveValue("10.00");
  expect(screen.getByRole("combobox", { name: es.statementBank })).toHaveTextContent("Elegida");
  expect(screen.getByRole("combobox", { name: es.statementClient })).toHaveTextContent("Lupe");
});
it("uses the confirmed UUID even if history ordering disagrees, retains it on navigation and focuses its heading", async () => {
  const f = await open();
  fireEvent.click(screen.getByRole("button", { name: es.confirmSale }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: es.confirmSale }));
  await waitFor(() =>
    expect(f.invoke).toHaveBeenCalledWith("saleDetail", expect.objectContaining({ saleId: saved })),
  );
  await screen.findByText("Concha confirmada exacta");
  expect(f.invoke).toHaveBeenCalledWith("saleDetail", expect.objectContaining({ saleId: saved }));
  await waitFor(() => expect(document.querySelector("[data-sale-ticket-heading]")).toHaveFocus());
  tab(es.nav.inventory);
  tab(es.nav.tickets);
  await screen.findByText("Concha confirmada exacta");
  expect(screen.queryByRole("article", { name: es.draftTicket })).not.toBeInTheDocument();
});
it("keeps the exact confirmed UUID through a failed refresh, focuses recovery and never sends another sale", async () => {
  const f = await open();
  const invoke = f.invoke.getMockImplementation();
  if (!invoke) throw Error("fixture");
  f.invoke.mockImplementationOnce(async (m, p) => {
    const result = await invoke(m, p);
    f.invoke.mockRejectedValueOnce(Error("refresh"));
    return result;
  });
  fireEvent.click(screen.getByRole("button", { name: es.confirmSale }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: es.confirmSale }));
  const message = await screen.findByText(es.errors.E_REFRESH_REQUIRED);
  const retry = within(message.closest("[role=alert]") as HTMLElement).getByRole("button", {
    name: es.retry,
  });
  await waitFor(() => expect(retry).toHaveFocus());
  fireEvent.click(retry);
  await screen.findByText("Concha confirmada exacta");
  await waitFor(() => expect(document.querySelector("[data-sale-ticket-heading]")).toHaveFocus());
  expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(1);
  expect(
    f.invoke.mock.calls
      .filter(([m]) => m === "saleDetail")
      .every(([, p]) => (p as { saleId: string }).saleId === saved),
  ).toBe(true);
});
it("shares F9 guards with the credit action and presents mandatory risk authorization", async () => {
  const f = await mount();
  fireEvent.keyDown(document, { key: "F9", ctrlKey: true });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.keyDown(document, { key: "F9" });
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText(es.exceptionReason)).toBeRequired();
  expect(within(dialog).getByRole("button", { name: es.authorizeCharge })).toBeEnabled();
  expect(within(dialog).getByText(es.currentBalance)).toBeVisible();
  fireEvent.keyDown(document, { key: "F10" });
  expect(screen.getByRole("tab", { name: es.nav.sale, hidden: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  fireEvent.click(within(dialog).getByRole("button", { name: es.cancel }));
  await waitFor(() => expect(screen.getByRole("button", { name: es.chargeAccount })).toHaveFocus());
  expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(0);
});
it("keeps cash checkout blocked when the till is closed and transfer blocked with no configured banks", async () => {
  const f = seeded();
  f.data.cash = null;
  f.data.settings.banks = [];
  f.data.settings.defaultBankId = null;
  f.mount();
  await screen.findByRole("button", { name: "Agregar Concha" });
  fireEvent.keyDown(document, { key: "F10" });
  expect(screen.getByRole("button", { name: es.confirmSale })).toBeDisabled();
  fireEvent.click(screen.getByRole("combobox", { name: es.paymentMethod }));
  fireEvent.click(screen.getByRole("option", { name: es.transfer }));
  expect(screen.getByRole("button", { name: es.confirmSale })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: es.checkoutBank })).toHaveTextContent(es.selectBank);
});
it("invalidates the captured confirmation after a rejected revision changes the draft, requiring review", async () => {
  const f = await open();
  fireEvent.click(screen.getByRole("button", { name: es.confirmSale }));
  const dialog = screen.getByRole("dialog");
  f.invoke.mockImplementationOnce(async () => {
    f.data.draft.lines = [{ productId: pid, qty: 2 }];
    f.data.revision += 1;
    return { kind: "rejected", issue: { code: "E_REVISION" } };
  });
  fireEvent.click(within(dialog).getByRole("button", { name: es.confirmSale }));
  expect(await within(dialog).findByText(es.reviewChangedDraft)).toBeVisible();
  expect(within(dialog).getByRole("button", { name: es.confirmSale })).toBeDisabled();
  const count = f.invoke.mock.calls.filter(([m]) => m === "execute").length;
  fireEvent.click(within(dialog).getByRole("button", { name: es.confirmSale }));
  fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
  expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(count);
  fireEvent.click(within(dialog).getByRole("button", { name: es.cancel }));
  expect(screen.getByRole("article", { name: es.draftTicket })).toHaveTextContent("$16.00");
  fireEvent.click(screen.getByRole("button", { name: es.confirmSale }));
  expect(
    within(screen.getByRole("dialog")).queryByText(es.reviewChangedDraft),
  ).not.toBeInTheDocument();
});

it("shows the confirmed UUID and keeps an enabled heading focused while its snapshot is delayed", async () => {
  const f = await open();
  const invoke = f.invoke.getMockImplementation();
  if (!invoke) throw Error("fixture");
  let release: () => void = () => {};
  f.invoke.mockImplementationOnce(async (method, params) => {
    const result = await invoke(method, params);
    f.invoke.mockImplementationOnce(async (snapshotMethod, snapshotParams) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return invoke(snapshotMethod, snapshotParams);
    });
    return result;
  });
  fireEvent.click(screen.getByRole("button", { name: es.confirmSale }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: es.confirmSale }));
  await screen.findByText("Concha confirmada exacta");
  await waitFor(() => expect(document.querySelector("[data-sale-ticket-heading]")).toHaveFocus());
  expect(screen.getByRole("button", { name: es.confirmSale })).toBeDisabled();
  await act(async () => release());
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: es.confirmSale })).not.toBeInTheDocument(),
  );
  expect(document.querySelector("[data-sale-ticket-heading]")).toHaveFocus();
  expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
});

for (const refresh of ["immediate", "delayed", "failed"] as const)
  it(`initial credit with ${refresh} snapshot starts the next different cart with a fresh payment`, async () => {
    const f = await mount();
    const invoke = f.invoke.getMockImplementation();
    if (!invoke) throw Error("fixture");
    let release: () => void = () => {};
    f.invoke.mockImplementationOnce(async (method, params) => {
      const result = await invoke(method, params);
      if (refresh === "delayed")
        f.invoke.mockImplementationOnce(async (snapshotMethod, snapshotParams) => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return invoke(snapshotMethod, snapshotParams);
        });
      if (refresh === "failed") f.invoke.mockRejectedValueOnce(Error("credit snapshot"));
      return result;
    });
    fireEvent.keyDown(document, { key: "F9" });
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(es.exceptionReason), {
      target: { value: "Crédito autorizado" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: es.authorizeCharge }));
    await screen.findByText("Concha confirmada exacta");
    if (refresh === "delayed") await act(async () => release());
    if (refresh === "failed") {
      const notice = await screen.findByText(es.errors.E_REFRESH_REQUIRED);
      fireEvent.click(
        within(notice.closest("[role=alert]") as HTMLElement).getByRole("button", {
          name: es.retry,
        }),
      );
    }
    await waitFor(() => expect(screen.getByRole("button", { name: es.newSale })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: es.newSale }));
    const add = screen.getByRole("button", { name: "Agregar Concha" });
    fireEvent.click(add);
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    await waitFor(() => expect(f.data.draft.lines[0]?.qty).toBe(2));
    await waitFor(() => expect(screen.getByRole("button", { name: es.checkout })).toBeEnabled());
    fireEvent.keyDown(document, { key: "F10" });
    expect(screen.getByLabelText(es.checkoutAppliedPayment)).toHaveValue("16.00");
    expect(screen.getByLabelText(es.checkoutReceivedCash)).toHaveValue("16.00");
    expect(
      f.invoke.mock.calls.filter(
        ([method, params]) =>
          method === "execute" && (params as { action: { type: string } }).action.type === "sell",
      ),
    ).toHaveLength(1);
  });

for (const variant of ["credit", "checkout"] as const)
  it(`invalidates ${variant} after a price-only revision without changing its captured summary or sending a second sale`, async () => {
    const f = variant === "credit" ? await mount() : await open();
    const draft = structuredClone(f.data.draft);
    if (variant === "credit") fireEvent.keyDown(document, { key: "F9" });
    else fireEvent.click(screen.getByRole("button", { name: es.confirmSale }));
    const dialog = screen.getByRole("dialog");
    const label = variant === "credit" ? es.authorizeCharge : es.confirmSale;
    if (variant === "credit")
      fireEvent.change(within(dialog).getByLabelText(es.exceptionReason), {
        target: { value: "Autorizado" },
      });
    f.invoke.mockImplementationOnce(async () => {
      const product = f.data.products[0];
      if (!product) throw Error("product");
      product.price = 1200;
      f.data.revision += 1;
      return { kind: "rejected", issue: { code: "E_REVISION" } };
    });
    fireEvent.click(within(dialog).getByRole("button", { name: label }));
    await within(dialog).findByText(es.reviewChangedDraft);
    expect(f.data.draft).toEqual(draft);
    expect(within(dialog).getByRole("button", { name: label })).toBeDisabled();
    expect(dialog.querySelector(".ventas-confirm-amount")).toHaveTextContent("$8.00");
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: es.cancel }));
    if (variant === "credit") fireEvent.keyDown(document, { key: "F9" });
    else fireEvent.click(screen.getByRole("button", { name: es.confirmSale }));
    const reviewed = screen.getByRole("dialog");
    expect(within(reviewed).queryByText(es.reviewChangedDraft)).not.toBeInTheDocument();
    expect(reviewed.querySelector(".ventas-confirm-amount")).toHaveTextContent(
      variant === "credit" ? "$12.00" : "$8.00",
    );
    if (variant === "checkout") expect(within(reviewed).getByText("$12.00")).toBeVisible();
  });
