import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import type {
  HistoryPage,
  ReturnDetail,
  SaleDetail,
  Statement,
} from "../shared/history-contracts.ts";
import { HistoryPanel } from "./HistoryPanel.tsx";
import { ReturnDetailButton } from "./ReturnDetailButton.tsx";
import { SaleDetailDialog } from "./SaleDetailDialog.tsx";
import { StatementTicket } from "./StatementTicket.tsx";
import type { ScreenProps } from "./types.ts";
import { fixture, pid } from "./ui-fixture.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es } },
    lng: "es",
    interpolation: { escapeValue: false },
  });
});
const rid = crypto.randomUUID(),
  rid2 = crypto.randomUUID(),
  rid3 = crypto.randomUUID();
function setup() {
  const f = fixture();
  const record = {
    id: rid,
    folio: 1,
    saleId: pid,
    reason: "Primera devolución",
    restock: true,
    amount: 100,
    cost: 33,
    refund: 100,
    method: "cash" as const,
    bankId: null,
    bankSnapshot: null,
    reference: "REF",
    cashId: null,
    at: "2026-11-07T18:00:00Z",
    date: "2026-11-07",
  };
  const events = [
    record,
    { ...record, id: rid2, folio: 2, reason: "Segundo producto", restock: false },
    { ...record, id: rid3, folio: 3, reason: "Final total" },
  ];
  const details: Record<string, ReturnDetail> = Object.fromEntries(
    events.map((r, n) => [
      r.id,
      {
        revision: 0,
        record: r,
        saleFolio: 1,
        lines: {
          total: 1,
          nextOffset: null,
          rows: [
            {
              id: crypto.randomUUID(),
              returnId: r.id,
              lineId: crypto.randomUUID(),
              productId: pid,
              qty: n + 1,
              amount: r.amount,
              cost: r.cost,
              name: `Producto histórico ${n + 1}`,
              price: 100,
            },
          ],
        },
      },
    ]),
  );
  const history: HistoryPage = {
    revision: 0,
    total: 3,
    nextOffset: null,
    rows: events.map((data) => ({ kind: "return", data })),
  };
  const read = vi.fn(async (method: string, params?: unknown): Promise<unknown> => {
    if (method === "history") return { kind: "ok", value: history };
    const p = params as { returnId: string; offset: number; limit: number };
    const d = details[p.returnId];
    if (!d) return { kind: "rejected", issue: { code: "E_NOT_FOUND" } };
    return {
      kind: "ok",
      value: {
        ...d,
        lines: {
          ...d.lines,
          rows: d.lines.rows.slice(p.offset, p.offset + p.limit),
          nextOffset: p.offset + p.limit < d.lines.total ? p.offset + p.limit : null,
        },
      },
    };
  });
  const props: ScreenProps = {
    data: f.data,
    read,
    run: vi.fn(async () => false),
    busy: false,
    operation: {
      issue: null,
      writing: false,
      loading: false,
      pendingConfirmation: false,
      confirmedOwner: null,
      confirmedId: null,
      retry: vi.fn(),
    },
  };
  return { props, details, history, read };
}
async function closeDetailTo(button: HTMLElement, mode: "Escape" | "X") {
  const dialog = screen.getByRole("dialog", { name: es.returnDetail });
  if (mode === "Escape") fireEvent.keyDown(dialog, { key: "Escape" });
  else fireEvent.click(within(dialog).getByRole("button", { name: /^(Cerrar|Close)$/ }));
  await waitFor(() => expect(button).toHaveFocus());
  expect(document.activeElement).toBe(button);
  expect(screen.queryByRole("dialog", { name: es.returnDetail })).not.toBeInTheDocument();
}
it("opens the lines of each return from history, including the final total event", async () => {
  const f = setup();
  render(<HistoryPanel {...f.props} kind="returns" />);
  const buttons = await screen.findAllByRole("button", { name: es.viewReturnDetail });
  for (const [n, button] of buttons.entries()) {
    button.focus();
    fireEvent.click(button);
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText(`Producto histórico ${n + 1}`)).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        n === 1
          ? `${es.returnDestination}: ${es.returnedAsLoss}`
          : `${es.returnDestination}: ${es.returnedToStock}`,
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("cell", { name: String(n + 1) })).toBeInTheDocument();
    expect(within(dialog).getByRole("columnheader", { name: es.cost })).toBeInTheDocument();
    await closeDetailTo(button, "Escape");
    fireEvent.click(button);
    await within(screen.getByRole("dialog")).findByText(`Producto histórico ${n + 1}`);
    await closeDetailTo(button, "X");
  }
});
it("keeps return detail available on a fully returned sale and its statement", async () => {
  const f = setup(),
    empty = { revision: 0, total: 0, nextOffset: null, rows: [] };
  const sale = {
    id: pid,
    folio: 1,
    clientId: null,
    clientSnapshot: null,
    business: f.props.data.settings,
    lines: [],
    total: 300,
    term: 1,
    due: "2026-11-08",
    exception: "",
    opening: false,
    note: "",
    received: 300,
    change: 0,
    at: "2026-11-07T18:00:00Z",
    date: "2026-11-07",
    initialPaymentId: null,
  };
  const detail: SaleDetail = {
    revision: 0,
    sale,
    balance: { saleId: pid, total: 0, paid: 0, pending: 0, due: sale.due },
    initialPayment: null,
    returned: [],
    payments: empty,
    returns: f.history,
  };
  const read = f.read.getMockImplementation();
  if (!read) throw new Error("Missing fixture");
  f.read.mockImplementation(async (method, params) =>
    method === "saleDetail" ? { kind: "ok", value: detail } : read(method, params),
  );
  const view = render(<SaleDetailDialog {...f.props} saleId={pid} close={vi.fn()} />);
  const links = await screen.findAllByRole("button", { name: es.viewReturnDetail });
  expect(links).toHaveLength(3);
  const finalLink = links[2];
  if (!finalLink) throw new Error("Missing return link");
  finalLink.focus();
  fireEvent.click(finalLink);
  const nested = screen.getByRole("dialog", { name: es.returnDetail });
  expect(await within(nested).findByText("Producto histórico 3")).toBeInTheDocument();
  await closeDetailTo(finalLink, "Escape");
  expect(screen.getByRole("dialog", { name: es.saleDetail })).toBeInTheDocument();
  // The exact trigger remains usable inside the parent modal after either close path.
  fireEvent.click(finalLink);
  await within(screen.getByRole("dialog", { name: es.returnDetail })).findByText(
    "Producto histórico 3",
  );
  await closeDetailTo(finalLink, "X");
  expect(screen.getByRole("dialog", { name: es.saleDetail })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: es.returnOrCancel })).not.toBeInTheDocument();
  const statement: Statement = {
    revision: 0,
    client: { id: pid, name: "Cliente", phone: "", term: 1, limit: null, active: true },
    business: f.props.data.settings,
    bankSnapshot: null,
    account: { clientId: pid, balance: 0, totalPaid: 0, overdue: 0, nextDue: null },
    today: "2026-11-07",
    salesPage: empty,
    sales: [],
    payments: empty,
    returns: f.history,
  };
  view.rerender(<StatementTicket statement={statement} read={f.props.read} />);
  const statementLink = screen.getAllByRole("button", { name: es.viewReturnDetail })[2];
  if (!statementLink) throw new Error("Missing statement link");
  for (const mode of ["Escape", "X"] as const) {
    statementLink.focus();
    fireEvent.click(statementLink);
    expect(
      await within(screen.getByRole("dialog")).findByText("Producto histórico 3"),
    ).toBeInTheDocument();
    await closeDetailTo(statementLink, mode);
  }
});
it("paginates historical return lines and recovers query failures inside the real dialog", async () => {
  const f = setup(),
    d = f.details[rid];
  if (!d?.lines.rows[0]) throw new Error("Missing fixture");
  d.lines.rows = Array.from({ length: 25 }, (_, n) => ({
    ...(d.lines.rows[0] as ReturnDetail["lines"]["rows"][number]),
    id: crypto.randomUUID(),
    name: `Línea histórica ${n + 1}`,
  }));
  d.lines.total = 25;
  f.read.mockRejectedValueOnce(new Error("Transport"));
  render(<ReturnDetailButton returnId={rid} read={f.props.read} revision={0} />);
  fireEvent.click(screen.getByRole("button", { name: es.viewReturnDetail }));
  const dialog = screen.getByRole("dialog");
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(es.errors.E_INTERNAL);
  fireEvent.click(within(dialog).getByRole("button", { name: es.retry }));
  expect(await within(dialog).findByText("Línea histórica 20")).toBeInTheDocument();
  expect(within(dialog).queryByText("Línea histórica 21")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: es.nextPage }));
  expect(await within(dialog).findByText("Línea histórica 25")).toBeInTheDocument();
  expect(within(dialog).getByText(/21–25 de 25/)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: es.nextPage })).toBeDisabled();
});
