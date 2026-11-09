import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { dateText } from "./format.ts";
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
const cid = "9d44e2be-d3d6-4d73-ad57-65011a4a12d7";
async function english(f: ReturnType<typeof fixture>) {
  await act(async () =>
    f.context({
      theme: "light",
      accent: "blue",
      locale: "en",
      hostVersion: "0.5.0",
      toolVersion: "0.1.0",
    }),
  );
}

describe("Ventas history dates and stale cart", () => {
  it("keeps operational days at midnight and calendar boundaries in both locales", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/Mexico_City";
    try {
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date("2027-01-01T05:59:59Z"));
      expect(day).toBe("2026-12-31");
      expect(dateText(day, "es")).toBe("31/12/2026");
      expect(dateText(day, "en")).toBe("12/31/2026");
      expect(dateText("2028-02-29", "es")).toBe("29/02/2028");
      expect(dateText("2028-02-29", "en")).toBe("02/29/2028");
      expect(dateText("2027-01-01", "es")).toBe("01/01/2027");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
  it("localizes header and account due dates without changing their calendar days", async () => {
    const f = fixture();
    f.data.clients.push({
      id: cid,
      name: "Tienda",
      phone: "",
      term: 15,
      limit: null,
      active: true,
    });
    f.data.accounts.push({
      clientId: cid,
      balance: 100,
      overdue: 0,
      nextDue: "2026-12-01",
      totalPaid: 0,
    });
    f.rows.push({
      kind: "sale",
      data: {
        id: pid,
        folio: 1,
        clientId: cid,
        clientName: "Tienda",
        date: "2026-11-07",
        due: "2026-12-01",
        total: 100,
        net: 100,
        paid: 0,
        pending: 100,
        opening: false,
        note: "",
      },
    });
    f.mount();
    expect(await screen.findByText("07/11/2026")).toBeInTheDocument();
    fireEvent.mouseDown(
      within(screen.getByRole("navigation")).getByRole("tab", { name: es.nav.accounts }),
    );
    expect(screen.getByText("01/12/2026")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "01/12/2026" })).toBeInTheDocument();
    expect(screen.queryByText("2026-12-01")).not.toBeInTheDocument();
    await english(f);
    await waitFor(() => expect(screen.getAllByText("12/01/2026").length).toBeGreaterThan(0));
    expect(await screen.findByRole("cell", { name: "12/01/2026" })).toBeInTheDocument();
    expect(screen.getAllByText("11/07/2026").length).toBeGreaterThan(0);
  });
  it("shows persisted expense reference and locale-specific operational dates", async () => {
    const f = fixture();
    f.data.outflows.push({
      id: pid,
      kind: "expense",
      concept: "Transporte",
      category: "Ruta",
      amount: 100,
      method: "transfer",
      bankId: null,
      bankSnapshot: null,
      cashId: null,
      reference: "REF-GASTO-123",
      at: "2026-12-31T23:59:59Z",
      date: "2026-12-31",
    });
    f.mount();
    await screen.findByText(es.emptyCatalog);
    fireEvent.mouseDown(
      within(screen.getByRole("navigation")).getByRole("tab", { name: es.nav.expenses }),
    );
    expect(screen.getByText("31/12/2026")).toBeInTheDocument();
    expect(screen.getByText("Referencia: REF-GASTO-123")).toBeInTheDocument();
    await english(f);
    expect(await screen.findByText("12/31/2026")).toBeInTheDocument();
    expect(screen.getByText("Reference: REF-GASTO-123")).toBeInTheDocument();
  });
  it("reduces or removes a stale inactive cart line while retaining the other line", async () => {
    const f = fixture(),
      other = "9d44e2be-d3d6-4d73-ad57-65011a4a12d8";
    f.data.products.push(
      {
        id: pid,
        name: "A",
        category: "Dulces",
        kind: "simple",
        unit: "piece",
        price: 100,
        minStock: 0,
        stock: 2,
        value: 100,
        lastValue: 100,
        lastQty: 2,
        icon: null,
        active: false,
      },
      {
        id: other,
        name: "B",
        category: "Dulces",
        kind: "simple",
        unit: "piece",
        price: 100,
        minStock: 0,
        stock: 2,
        value: 100,
        lastValue: 100,
        lastQty: 2,
        icon: null,
        active: true,
      },
    );
    f.data.draft = {
      clientId: null,
      lines: [
        { productId: pid, qty: 5 },
        { productId: other, qty: 1 },
      ],
    };
    f.mount();
    const minus = await screen.findByRole("button", {
      name: es.removeNamedPiece.replace("{{name}}", "A"),
    });
    expect(
      screen.getByRole("button", { name: es.addNamedPiece.replace("{{name}}", "A") }),
    ).toBeDisabled();
    fireEvent.click(minus);
    await waitFor(() =>
      expect(f.data.draft.lines).toEqual([
        { productId: pid, qty: 4 },
        { productId: other, qty: 1 },
      ]),
    );
    for (let count = 3; count >= 0; count--) {
      const remove = screen.getByRole("button", {
        name: es.removeNamedPiece.replace("{{name}}", "A"),
      });
      await waitFor(() => expect(remove).toBeEnabled());
      fireEvent.click(remove);
      await waitFor(() =>
        expect(f.data.draft.lines).toEqual([
          ...(count ? [{ productId: pid, qty: count }] : []),
          { productId: other, qty: 1 },
        ]),
      );
    }
    expect(
      screen.queryByRole("button", { name: es.removeNamedPiece.replace("{{name}}", "A") }),
    ).not.toBeInTheDocument();
    expect(f.data.products[0]?.stock).toBe(2);
  });
});
