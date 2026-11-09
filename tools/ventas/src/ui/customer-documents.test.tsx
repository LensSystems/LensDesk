import { fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import type { SaleDetail, Statement } from "../shared/history-contracts.ts";
import type { PaymentInput, SaleRecord } from "../shared/trading-contracts.ts";
import { DraftTicket } from "./DraftTicket.tsx";
import { dateText, moneyText } from "./format.ts";
import { SaleConfirmationSummary } from "./SaleConfirmationSummary.tsx";
import { SaleTicket } from "./SaleTicket.tsx";
import { StatementTicket } from "./StatementTicket.tsx";
import { fixture, pid } from "./ui-fixture.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: "es",
    fallbackLng: "es",
    interpolation: { escapeValue: false },
  });
});
function documents() {
  const f = fixture(),
    clientId = "9d44e2be-d3d6-4d73-ad57-65011a4a12d1",
    bankId = "9d44e2be-d3d6-4d73-ad57-65011a4a12d2";
  const client = {
    id: clientId,
    name: "Cliente actual",
    phone: "",
    term: 17,
    limit: null,
    active: true,
  };
  const bank = {
    id: bankId,
    bank: "Banco actual",
    holder: "Titular actual",
    clabe: "012345678901234567",
  };
  f.data.today = "2037-02-20";
  f.data.settings = {
    name: "Negocio actual",
    address: "Dirección actual",
    phone: "123",
    thanks: "Gracias actual",
    banks: [bank],
  };
  f.data.clients.push(client);
  const account = {
    clientId,
    balance: 7500,
    overdue: 7500,
    nextDue: "2037-01-19",
    totalPaid: 2500,
  };
  f.data.accounts.push(account);
  f.data.products.push({
    id: pid,
    name: "Producto conservado",
    category: "Prueba",
    kind: "simple",
    unit: "piece",
    price: 10000,
    minStock: 5,
    stock: 10,
    value: 50000,
    lastValue: 50000,
    lastQty: 10,
    icon: null,
    active: true,
  });
  f.data.draft = { clientId, lines: [{ productId: pid, qty: 1 }] };
  const sale: SaleRecord = {
    id: pid,
    folio: 1,
    clientId,
    clientSnapshot: { ...client, name: "Cliente histórico" },
    business: { ...f.data.settings, name: "Negocio histórico", thanks: "Gracias histórico" },
    lines: [
      {
        id: "9d44e2be-d3d6-4d73-ad57-65011a4a12d3",
        productId: pid,
        name: "Producto conservado",
        qty: 1,
        price: 10000,
        cost: 5000,
      },
    ],
    total: 10000,
    term: 17,
    due: "2037-01-19",
    exception: "",
    opening: false,
    note: "",
    received: 2500,
    change: 0,
    at: "2037-01-02T18:00:00Z",
    date: "2037-01-02",
    initialPaymentId: "9d44e2be-d3d6-4d73-ad57-65011a4a12d4",
  };
  const empty = { revision: 0, total: 0, nextOffset: null, rows: [] };
  const detail: SaleDetail = {
    revision: 0,
    sale,
    balance: { saleId: pid, total: 10000, paid: 2500, pending: 7500, due: sale.due },
    initialPayment: {
      id: sale.initialPaymentId ?? "",
      folio: 1,
      clientId,
      amount: 2500,
      method: "transfer",
      bankId,
      bankSnapshot: { ...bank, bank: "Banco histórico", holder: "Titular histórico" },
      reference: "ORIGINAL",
      cashId: null,
      at: sale.at,
      date: sale.date,
      allocations: [{ saleId: pid, amount: 2500 }],
      opening: false,
      reversalId: null,
    },
    returned: [],
    payments: empty,
    returns: empty,
  };
  const statement: Statement = {
    revision: 0,
    client,
    business: f.data.settings,
    bankSnapshot: bank,
    account,
    today: f.data.today,
    salesPage: {
      revision: 0,
      total: 1,
      nextOffset: null,
      rows: [
        {
          kind: "sale",
          data: {
            id: pid,
            folio: 1,
            clientId,
            clientName: client.name,
            date: sale.date,
            due: sale.due,
            total: 10000,
            net: 10000,
            paid: 2500,
            pending: 7500,
            opening: false,
            note: "",
          },
        },
      ],
    },
    sales: [sale],
    payments: empty,
    returns: empty,
  };
  const payment: PaymentInput = {
    amount: 2500,
    received: 2500,
    method: "transfer",
    bankId,
    reference: "BORRADOR",
  };
  const props = {
    data: f.data,
    run: vi.fn(async () => true),
    read: vi.fn(async () => ({})),
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
  return { f, client, sale, account, detail, statement, payment, props };
}
describe("customer documents keep credit schedules internal", () => {
  it.each(["es", "en"] as const)(
    "omits credit schedules from all three papers but preserves customer facts in %s",
    async (locale) => {
      await i18n.changeLanguage(locale);
      const d = documents(),
        labels = locale === "es" ? es : en;
      const before = structuredClone({ data: d.f.data, detail: d.detail, statement: d.statement });
      render(
        <>
          <DraftTicket {...d.props} total={10000} payment={d.payment} />
          <SaleTicket detail={d.detail} />
          <StatementTicket statement={d.statement} read={d.props.read} />
        </>,
      );
      for (const name of [labels.draftTicket, labels.saleTicket, labels.statement]) {
        const paper = screen.getByRole("article", { name });
        expect(paper).not.toHaveTextContent(
          /vencimiento|\bvence\b|vencido|due date|overdue|credit term|plazo/i,
        );
        expect(paper).not.toHaveTextContent(dateText("2037-01-19", locale));
        expect(paper).not.toHaveTextContent(dateText("2037-03-09", locale));
        expect(paper).not.toHaveTextContent("2037-01-19");
        expect(paper).not.toHaveTextContent("2037-03-09");
        expect(paper).toHaveTextContent("Producto conservado");
        expect(paper).toHaveTextContent(moneyText(7500, locale));
        expect(paper).toHaveTextContent("012345678901234567");
      }
      const draft = screen.getByRole("article", { name: labels.draftTicket }),
        sale = screen.getByRole("article", { name: labels.saleTicket }),
        statement = screen.getByRole("article", { name: labels.statement });
      expect(draft).toHaveTextContent(dateText(d.f.data.today, locale));
      expect(draft).toHaveTextContent("Cliente actual");
      expect(draft).toHaveTextContent("Banco actual");
      expect(draft).toHaveTextContent(moneyText(2500, locale));
      expect(sale).toHaveTextContent(dateText(d.sale.date, locale));
      expect(sale).toHaveTextContent("Negocio histórico");
      expect(sale).toHaveTextContent("Cliente histórico");
      expect(sale).toHaveTextContent("Banco histórico");
      expect(sale).toHaveTextContent("Gracias histórico");
      expect(sale).toHaveTextContent(moneyText(10000, locale));
      expect(statement).toHaveTextContent(dateText(d.f.data.today, locale));
      expect(statement).toHaveTextContent(dateText(d.sale.date, locale));
      expect(statement).toHaveTextContent("Cliente actual");
      expect(statement).toHaveTextContent("Banco actual");
      expect(statement).toHaveTextContent(labels.pending);
      expect({ data: d.f.data, detail: d.detail, statement: d.statement }).toEqual(before);
      expect(d.props.run).not.toHaveBeenCalled();
    },
  );
  it.each(["es", "en"] as const)(
    "keeps account collections and credit confirmation schedules visible in %s",
    async (locale) => {
      await i18n.changeLanguage(locale);
      const d = documents(),
        labels = locale === "es" ? es : en;
      render(<SaleConfirmationSummary {...d.props} total={10000} payment={d.payment} credit />);
      expect(screen.getByText(labels.dueDate)).toBeInTheDocument();
      expect(screen.getByText(dateText("2037-03-09", locale))).toBeInTheDocument();
      expect(screen.getByText(i18n.t("termDays", { count: 17 }))).toBeInTheDocument();
      d.f.context({
        theme: "light",
        locale,
        accent: "blue",
        hostVersion: "0.5.0",
        toolVersion: "0.1.0",
      });
      d.f.mount();
      await screen.findByRole("navigation");
      fireEvent.mouseDown(
        within(screen.getByRole("navigation")).getByRole("tab", { name: labels.nav.accounts }),
      );
      expect(await screen.findByText(dateText("2037-01-19", locale))).toBeInTheDocument();
      expect(screen.getAllByText(labels.overdue).length).toBeGreaterThan(0);
      expect(
        screen.getByText(i18n.t("termPerPurchase", { days: 17 }), { exact: false }),
      ).toBeInTheDocument();
      expect(d.sale).toMatchObject({ due: "2037-01-19", term: 17 });
      expect(d.account).toMatchObject({ overdue: 7500, nextDue: "2037-01-19" });
    },
  );
});
