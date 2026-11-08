import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { accountStatus, visibleAccounts } from "./account-status.ts";
import { SummaryPage } from "./SummaryPage.tsx";
import type { ScreenProps } from "./types.ts";
import { fixture } from "./ui-fixture.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es } },
    lng: "es",
    interpolation: { escapeValue: false },
  });
});
const summary = {
  from: "2026-11-07",
  to: "2026-11-07",
  revenue: 100,
  cogs: 40,
  expenses: 0,
  loss: 0,
  profit: 60,
  received: 25,
  cash: 25,
  transfer: 0,
  purchases: 0,
  withdrawals: 0,
  balance: 400,
  overdue: 100,
  count: 1,
  top: [],
};
function seeded() {
  const f = fixture();
  for (const [i, name] of ["Vencido", "Hoy", "Tres", "Cuatro", "Cero", "Inactivo"].entries()) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    f.data.clients.push({ id, name, phone: "", term: 15, limit: null, active: i !== 5 });
    f.data.accounts.push({
      clientId: id,
      balance: i === 4 ? 0 : 100,
      overdue: i === 0 ? 100 : 0,
      nextDue:
        i === 4
          ? null
          : (["2026-11-06", "2026-11-07", "2026-11-10", "2026-11-11", "", "2026-11-10"][i] ?? null),
      totalPaid: 0,
    });
  }
  const base = f.invoke.getMockImplementation();
  f.invoke.mockImplementation(async (method, params) =>
    method === "summary"
      ? { kind: "ok", value: { ...summary, ...(params as object) } }
      : base?.(method, params),
  );
  return f;
}
const tab = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }));
it("uses exact +3/+4, today, zero and inactive attention rules without sorting names", () => {
  const f = seeded(),
    state = { selected: null, query: "", filter: "attention" as const };
  expect(f.data.accounts.map((a) => accountStatus(a, f.data.today))).toEqual([
    "overdue",
    "soon",
    "soon",
    "current",
    "clear",
    "soon",
  ]);
  expect(visibleAccounts(f.data, state, "es").map((c) => c.name)).toEqual([
    "Vencido",
    "Hoy",
    "Tres",
    "Inactivo",
  ]);
  expect(visibleAccounts(f.data, { ...state, filter: "clear" }, "es").map((c) => c.name)).toEqual([
    "Cero",
  ]);
});
it("keeps selected detail while filtering and preserves UI across screens; links use exact IDs and focus", async () => {
  const f = seeded();
  f.mount();
  await screen.findByText(es.emptyCatalog);
  tab(es.nav.accounts);
  const sidebar = document.querySelector(".ventas-account-sidebar") as HTMLElement;
  fireEvent.click(within(sidebar).getByRole("button", { name: /Cuatro/ }));
  fireEvent.click(screen.getByRole("button", { name: es.accountFiltersLabels.attention }));
  expect(screen.getByRole("heading", { name: "Cuatro" })).toBeVisible();
  expect(within(sidebar).queryByRole("button", { name: /Cuatro/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(es.searchClient), { target: { value: "Tres" } });
  tab(es.nav.inventory);
  tab(es.nav.accounts);
  expect(screen.getByLabelText(es.searchClient)).toHaveValue("Tres");
  expect(screen.getByRole("button", { name: es.accountFiltersLabels.attention })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("heading", { name: "Cuatro" })).toBeVisible();
  expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(0);
  tab(es.nav.summary);
  await screen.findByRole("heading", { name: es.accountsToAttend });
  const link = screen.getByRole("button", { name: "Cuatro" });
  link.focus();
  fireEvent.click(link);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Cuatro" })).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: es.statement }));
  await waitFor(() => expect(screen.getByRole("heading", { name: es.statement })).toHaveFocus());
  expect(screen.getByRole("combobox", { name: es.statementClient })).toHaveTextContent("Cuatro");
  expect(f.invoke).toHaveBeenCalledWith(
    "statement",
    expect.objectContaining({ clientId: f.data.clients[3]?.id }),
  );
});
it("shows all positive balances in Summary including future/inactive, top6 stable; current catalog labels and immediate bars", async () => {
  const f = seeded(),
    p = {
      id: crypto.randomUUID(),
      name: "Actual",
      category: "Dulces",
      kind: "simple" as const,
      unit: "piece" as const,
      price: 100,
      stock: 1,
      value: 40,
      lastValue: 40,
      lastQty: 1,
      active: true,
      minStock: 0,
    };
  f.data.products.push(p);
  for (let i = 0; i < 3; i++) {
    const id = crypto.randomUUID();
    f.data.clients.push({ id, name: `Extra ${i}`, phone: "", term: 15, limit: null, active: true });
    f.data.accounts.push({
      clientId: id,
      balance: 100,
      overdue: 0,
      nextDue: "2026-11-20",
      totalPaid: 0,
    });
  }
  const s = { ...summary, top: [{ productId: p.id, name: "Histórico", qty: 3 }] };
  const read = vi.fn(async () => ({ kind: "ok", value: s }));
  const props = {
    data: f.data,
    read,
    run: vi.fn(),
    busy: false,
    operation: {
      writing: false,
      loading: false,
      issue: null,
      pendingConfirmation: false,
      confirmedOwner: null,
      confirmedId: null,
      retry: vi.fn(),
    },
  } as ScreenProps;
  render(<SummaryPage {...props} />);
  await screen.findByText("Actual");
  expect(screen.queryByText("Histórico")).not.toBeInTheDocument();
  expect(screen.getByText("3 piezas netas")).toBeVisible();
  expect(
    [...document.querySelectorAll(".ventas-summary-event button")].map((e) => e.textContent),
  ).toEqual(["Vencido", "Hoy", "Tres", "Cuatro", "Inactivo", "Extra 0"]);
  expect(screen.queryByLabelText(es.fromDate)).not.toBeInTheDocument();
});
it("preserves period on navigation and ignores an older async Summary response, then retries error", async () => {
  const f = seeded();
  f.data.today = "2026-11-15";
  f.mount();
  await screen.findByText(es.emptyCatalog);
  tab(es.nav.summary);
  await screen.findByRole("heading", { name: es.accountsToAttend });
  fireEvent.click(screen.getByRole("radio", { name: es.summaryWeek }));
  tab(es.nav.accounts);
  tab(es.nav.summary);
  expect(screen.getByRole("radio", { name: es.summaryWeek })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  let resolveOld: ((value: unknown) => void) | undefined;
  const base = f.invoke.getMockImplementation();
  f.invoke.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("radio", { name: es.periods.month }));
  fireEvent.click(screen.getByRole("radio", { name: es.periods.today }));
  await waitFor(() =>
    expect(f.invoke).toHaveBeenLastCalledWith("summary", { from: f.data.today, to: f.data.today }),
  );
  await act(async () => resolveOld?.({ kind: "ok", value: { ...summary, revenue: 999999 } }));
  expect(screen.queryByText(/9,999.99/)).not.toBeInTheDocument();
  f.invoke.mockImplementationOnce(async () => ({ kind: "rejected", issue: { code: "E_LIMIT" } }));
  fireEvent.click(screen.getByRole("radio", { name: es.summaryWeek }));
  await screen.findByRole("alert");
  f.invoke.mockImplementation(base ?? (() => Promise.resolve(null)));
  fireEvent.click(screen.getByRole("button", { name: es.retry }));
  await screen.findByRole("heading", { name: es.accountsToAttend });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
