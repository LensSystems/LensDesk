import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
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
const select = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }));

describe("Ventas navigation", () => {
  it("uses one active panel related to its tab, including the settings gear", async () => {
    fixture().mount();
    await screen.findByText(es.emptyCatalog);
    const nav = screen.getByRole("navigation", { name: es.navigation });
    expect(within(nav).getAllByRole("tab")).toHaveLength(7);
    expect(within(nav).getByRole("tablist")).toHaveAccessibleName(es.navigation);
    for (const name of [es.nav.sale, es.nav.inventory, es.nav.settings, es.nav.sale]) {
      select(name);
      if (name === es.nav.inventory) {
        expect(screen.getByRole("heading", { name, level: 1 })).toHaveClass("ventas-page-title");
      }
      const tab = screen.getByRole("tab", { name });
      const panel = screen.getByRole("tabpanel");
      expect(tab).toHaveAttribute("aria-selected", "true");
      expect(tab.getAttribute("aria-controls")).toBe(panel.id);
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
      expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(1);
    }
    select(es.nav.accounts);
    expect(screen.getByRole("heading", { name: es.nav.accounts, level: 2 })).toHaveClass(
      "ventas-section-heading",
    );
    expect(screen.getByRole("heading", { name: es.emptyClients, level: 1 })).not.toHaveClass(
      "ventas-page-title",
    );
    select(es.nav.sale);
    expect(screen.getByRole("heading", { name: es.emptyCatalog, level: 1 })).not.toHaveClass(
      "ventas-page-title",
    );
    expect(screen.queryByLabelText(es.businessName)).not.toBeInTheDocument();
    expect(document.title).toBe(es.title);
    expect(screen.getByRole("tab", { name: es.nav.settings }).querySelector("svg")).not.toBeNull();
  });

  it("counts overdue accounts including inactive clients, without counting future balances", async () => {
    const f = fixture();
    for (let index = 0; index < 4; index++) {
      const id = `9d44e2be-d3d6-4d73-ad57-65011a4a12d${index}`;
      f.data.clients.push({
        id,
        name: `Cliente ${index}`,
        phone: "",
        term: 15,
        limit: null,
        active: index !== 1,
      });
      f.data.accounts.push({
        clientId: id,
        balance: index === 3 ? 0 : 5000,
        overdue: index < 2 ? 100 : 0,
        nextDue: null,
        totalPaid: 0,
      });
    }
    f.mount();
    await screen.findByText(es.emptyCatalog);
    expect(screen.getByRole("tab", { name: es.nav.accounts })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: es.nav.accounts })).toHaveAccessibleDescription(
      "2 cuentas vencidas",
    );
    await act(async () =>
      f.context({
        theme: "dark",
        accent: "green",
        locale: "en",
        hostVersion: "0.5.0",
        toolVersion: "0.1.0",
      }),
    );
    expect(screen.getByRole("tab", { name: en.nav.accounts })).toHaveAccessibleDescription(
      "2 overdue accounts",
    );
    expect(document.title).toBe(en.title);
  });

  it("keeps the saved sale draft and client through tab changes and cash dialog dismissal", async () => {
    const f = fixture();
    f.data.products.push({
      id: pid,
      name: "Gomitas",
      category: "Dulces",
      kind: "simple",
      unit: "piece",
      price: 1500,
      minStock: 0,
      stock: 10,
      value: 1000,
      lastValue: 1000,
      lastQty: 10,
      active: true,
    });
    f.data.clients.push({
      id: pid,
      name: "Cliente borrador",
      phone: "",
      term: 15,
      limit: null,
      active: true,
    });
    f.data.draft = { clientId: pid, lines: [{ productId: pid, qty: 3 }] };
    const draft = structuredClone(f.data.draft);
    f.mount();
    await screen.findByRole("combobox", { name: es.client });
    select(es.nav.inventory);
    select(es.nav.settings);
    select(es.nav.sale);
    expect(screen.getByRole("combobox", { name: es.client })).toHaveValue("Cliente borrador");
    expect(screen.getByRole("heading", { name: es.currentSale, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: es.products, level: 3 })).toHaveClass(
      "ventas-cart-products-title",
    );
    expect(screen.queryByRole("heading", { name: "Gomitas" })).not.toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: es.addNamedProduct.replace("{{name}}", "Gomitas") })
        .querySelector("strong.ventas-product-name"),
    ).toHaveTextContent("Gomitas");
    expect(f.data.draft).toEqual(draft);
    const cash = screen.getByRole("button", { name: es.openCash });
    cash.focus();
    fireEvent.click(cash);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: es.close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(cash).toHaveFocus());
    fireEvent.click(cash);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(cash).toHaveFocus());
    expect(f.data.draft).toEqual(draft);
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(0);
    expect(screen.getByRole("tab", { name: es.nav.sale })).toHaveAttribute("aria-selected", "true");
  });
});
