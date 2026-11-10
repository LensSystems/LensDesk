import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import type { SaleDetail } from "../shared/history-contracts.ts";
import { dateText } from "./format.ts";
import { TicketList } from "./TicketList.tsx";
import { emptyWorkspace } from "./ticket-workspace.ts";
import { fixture, pid } from "./ui-fixture.tsx";
import { useSales } from "./use-sales.ts";
import { useTicketWorkspace } from "./use-ticket-workspace.ts";

const bid = "9d44e2be-d3d6-4d73-ad57-65011a4a12d1";
const cid = "9d44e2be-d3d6-4d73-ad57-65011a4a12d2";
const empty = { revision: 0, total: 0, nextOffset: null, rows: [] };
function seed() {
  const f = fixture();
  f.data.settings.name = "Negocio actual";
  f.data.settings.banks.push({
    id: bid,
    bank: "Banco actual",
    holder: "Titular",
    clabe: "012345678901234567",
  });
  f.data.clients.push({ id: cid, name: "Cliente", phone: "", term: 15, limit: null, active: true });
  f.data.accounts.push({ clientId: cid, balance: 0, overdue: 0, nextDue: null, totalPaid: 0 });
  const detail: SaleDetail = {
    revision: 0,
    sale: {
      id: pid,
      folio: 1,
      clientId: cid,
      clientSnapshot: f.data.clients[0] ?? null,
      business: { ...f.data.settings, name: "Original A" },
      lines: [],
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
      initialPaymentId: null,
    },
    balance: { saleId: pid, total: 100, paid: 0, pending: 100, due: "2026-11-22" },
    initialPayment: null,
    returned: [],
    payments: empty,
    returns: empty,
  };
  f.details[pid] = detail;
  f.rows.push({
    kind: "sale",
    data: {
      id: pid,
      folio: 1,
      clientId: cid,
      clientName: "Cliente",
      date: detail.sale.date,
      due: detail.sale.due,
      total: 100,
      net: 100,
      paid: 0,
      pending: 100,
      opening: false,
      note: "",
    },
  });
  return { ...f, detail };
}
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: "es",
    fallbackLng: "es",
    interpolation: { escapeValue: false },
  });
});
const navigate = (key: keyof typeof es.nav) =>
  fireEvent.mouseDown(
    within(screen.getByRole("navigation")).getByRole("tab", { name: es.nav[key] }),
  );
it("keeps the selected UUID and filters through empty searches, pages and navigation", async () => {
  const f = seed();
  for (let n = 2; n <= 45; n++)
    f.rows.push({
      ...f.rows[0],
      data: { ...f.rows[0]?.data, id: crypto.randomUUID(), folio: n },
    } as (typeof f.rows)[number]);
  f.mount();
  await screen.findByText(es.emptyCatalog);
  navigate("tickets");
  await screen.findByRole("article", { name: es.saleTicket });
  const list = screen.getByRole("complementary");
  fireEvent.click(within(list).getByRole("button", { name: es.nextPage }));
  await within(list).findByText(/21–40 de 45/);
  expect(
    within(screen.getByRole("article", { name: es.saleTicket })).getByText("Original A"),
  ).toBeVisible();
  navigate("summary");
  navigate("tickets");
  await screen.findByText(/21–40 de 45/);
  fireEvent.change(screen.getByLabelText(es.searchHistory), { target: { value: "No existe" } });
  await screen.findByText(es.noConfirmedSales);
  expect(
    within(screen.getByRole("article", { name: es.saleTicket })).getByText("Original A"),
  ).toBeVisible();
  navigate("summary");
  navigate("tickets");
  expect(screen.getByLabelText(es.searchHistory)).toHaveValue("No existe");
  await screen.findByText(es.noConfirmedSales);
  expect(screen.getByRole("article", { name: es.saleTicket })).toHaveTextContent("Original A");
  fireEvent.click(
    within(screen.getByRole("complementary")).getByRole("button", { name: es.periods.week }),
  );
  navigate("summary");
  navigate("tickets");
  expect(
    within(screen.getByRole("complementary")).getByRole("button", { name: es.periods.week }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByRole("article", { name: es.saleTicket })).toHaveTextContent(
    "Original A",
  );
});
it("preserves valid selection and independent client/bank on restore and validates the UUID outside bounded history", async () => {
  const f = seed(),
    read = vi.fn(async () => ({ kind: "ok", value: f.detail }));
  const { result, rerender } = renderHook(
    ({ restore }) => useTicketWorkspace({ data: f.data, restoredId: restore }, read),
    { initialProps: { restore: null as string | null } },
  );
  act(() =>
    result.current[1]({
      ...emptyWorkspace,
      initialized: true,
      selected: pid,
      review: true,
      clientId: cid,
      bankId: bid,
    }),
  );
  rerender({ restore: "restore1" });
  await waitFor(() =>
    expect(read).toHaveBeenCalledWith(
      "saleDetail",
      expect.objectContaining({ saleId: pid, revision: 0 }),
    ),
  );
  expect(result.current[0]).toMatchObject({
    selected: pid,
    clientId: cid,
    bankId: bid,
    review: true,
    autoSelect: false,
  });
});
it("does not invalidate while pending, on malformed results or errors; clears only a current typed not-found", async () => {
  const f = seed();
  let release: (x: unknown) => void = () => {};
  const read = vi.fn(
    () =>
      new Promise<unknown>((r) => {
        release = r;
      }),
  );
  const { result, rerender } = renderHook(
    ({ restore }) => useTicketWorkspace({ data: f.data, restoredId: restore }, read),
    { initialProps: { restore: null as string | null } },
  );
  act(() =>
    result.current[1]({
      ...emptyWorkspace,
      selected: pid,
      review: true,
      clientId: cid,
      bankId: bid,
    }),
  );
  rerender({ restore: "pending" });
  expect(result.current[0].selected).toBe(pid);
  await act(async () => release({ kind: "ok", value: {} }));
  expect(result.current[0].selected).toBe(pid);
  read.mockRejectedValueOnce(new Error("network"));
  rerender({ restore: "error" });
  await act(async () => {});
  expect(result.current[0].selected).toBe(pid);
  rerender({ restore: "lateA" });
  const old = release;
  act(() => result.current[1]({ ...result.current[0], selected: bid, clientId: cid, bankId: bid }));
  await act(async () => old({ kind: "rejected", issue: { code: "E_NOT_FOUND" } }));
  expect(result.current[0].selected).toBe(bid);
  await act(async () => release({ kind: "rejected", issue: { code: "E_NOT_FOUND" } }));
  expect(result.current[0]).toMatchObject({
    selected: null,
    review: false,
    clientId: cid,
    bankId: bid,
    autoSelect: false,
  });
});
it("clears absent restored client and bank without replacing them with current defaults", async () => {
  const f = seed();
  const { result, rerender } = renderHook(
    ({ restore }) =>
      useTicketWorkspace({ data: f.data, restoredId: restore }, f.client.backend.invoke),
    { initialProps: { restore: null as string | null } },
  );
  act(() =>
    result.current[1]({ ...emptyWorkspace, initialized: true, clientId: pid, bankId: pid }),
  );
  rerender({ restore: "missing" });
  expect(result.current[0]).toMatchObject({ clientId: null, bankId: null, initialized: true });
});
it("ignores delayed detail A after selection B and recovers B errors without another ticket leaking", async () => {
  const f = seed(),
    original = f.invoke.getMockImplementation();
  if (!original) throw new Error("Missing fixture");
  const second = structuredClone(f.detail);
  second.sale.id = bid;
  second.sale.folio = 2;
  second.sale.business.name = "Original B";
  second.balance.saleId = bid;
  f.details[bid] = second;
  f.rows.push({
    kind: "sale",
    data: {
      ...(f.rows[0] as Extract<(typeof f.rows)[number], { kind: "sale" }>).data,
      id: bid,
      folio: 2,
    },
  });
  let release: (v: unknown) => void = () => {};
  let fail = true;
  f.invoke.mockImplementation(async (method, params) => {
    if (method === "saleDetail" && (params as { saleId: string }).saleId === pid)
      return new Promise((r) => {
        release = r;
      });
    if (method === "saleDetail" && fail) {
      fail = false;
      return { kind: "rejected", issue: { code: "E_NOT_FOUND" } };
    }
    return original(method, params);
  });
  f.mount();
  await screen.findByText(es.emptyCatalog);
  navigate("tickets");
  const list = screen.getByRole("complementary");
  fireEvent.click(await within(list).findByRole("button", { name: /V-000002/ }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("article", { name: es.saleTicket })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: es.retry }));
  expect(await screen.findByRole("article", { name: es.saleTicket })).toHaveTextContent(
    "Original B",
  );
  await act(async () => release({ kind: "ok", value: f.detail }));
  expect(screen.getByRole("article", { name: es.saleTicket })).toHaveTextContent("Original B");
  expect(screen.getByRole("article", { name: es.saleTicket })).not.toHaveTextContent("Original A");
  const statementCalls = f.invoke.mock.calls.filter(([method]) => method === "statement");
  expect(statementCalls.every(([, p]) => (p as { clientId: string }).clientId === cid)).toBe(true);
});
it("updates the draft paper from edited checkout amounts and keeps stock and commands unchanged", async () => {
  const f = seed();
  f.data.products.push({
    id: pid,
    name: "Producto borrador",
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
  f.data.draft = { clientId: cid, lines: [{ productId: pid, qty: 2 }] };
  f.mount();
  await screen.findByRole("button", {
    name: i18n.t("addNamedProduct", { name: "Producto borrador" }),
  });
  navigate("tickets");
  const paper = await screen.findByRole("article", { name: es.draftTicket });
  const row = (label: string) => within(paper).getByText(label, { selector: "dt" }).closest("div");
  fireEvent.change(screen.getByLabelText(es.checkoutAppliedPayment), { target: { value: "5.00" } });
  fireEvent.change(screen.getByLabelText(es.checkoutReceivedCash), { target: { value: "10.00" } });
  expect(row(es.pending)).toHaveTextContent("$11.00");
  expect(row(es.change)).toHaveTextContent("$5.00");
  expect(paper).not.toHaveTextContent(dateText("2026-11-22", "es"));
  expect(paper).toHaveTextContent(dateText(f.data.today, "es"));
  expect(paper).toHaveTextContent(es.draftNotConfirmed);
  expect(f.data.products[0]?.stock).toBe(10);
  expect(f.invoke.mock.calls.some(([m]) => m === "execute")).toBe(false);
  fireEvent.change(screen.getByLabelText(es.checkoutAppliedPayment), {
    target: { value: "20.00" },
  });
  expect(row(es.pending)).toHaveTextContent("—");
  expect(paper).toHaveTextContent(es.draftPaymentInvalid);
  fireEvent.change(screen.getByLabelText(es.checkoutAppliedPayment), { target: { value: "0.00" } });
  expect(row(es.pending)).toHaveTextContent("$16.00");
});

it("clamps an out-of-range page only after a valid refreshed query without changing the selected UUID", async () => {
  const f = seed(),
    selected = vi.fn();
  const first = f.rows[0];
  if (first?.kind !== "sale") throw new Error("Missing sale");
  for (let n = 2; n <= 45; n++)
    f.rows.push({ kind: "sale", data: { ...first.data, id: crypto.randomUUID(), folio: n } });
  function List({ revision }: { revision: number }) {
    const operation = useSales(f.client);
    const [filters, setFilters] = useState({ ...emptyWorkspace.query, offset: 40 });
    return (
      <TicketList
        data={{ ...f.data, revision }}
        read={f.client.backend.invoke}
        run={operation.run}
        operation={operation}
        busy={operation.busy}
        filters={filters}
        onFilters={setFilters}
        selected={pid}
        autoSelect={false}
        onSelect={selected}
      />
    );
  }
  const view = render(<List revision={0} />);
  await screen.findByText(/41–45 de 45/);
  f.rows.splice(2);
  f.data.revision = 1;
  view.rerender(<List revision={1} />);
  await screen.findByText(/1–2 de 2/);
  expect(f.invoke).toHaveBeenCalledWith(
    "history",
    expect.objectContaining({ revision: 1, offset: 0 }),
  );
  expect(selected).not.toHaveBeenCalled();
});
