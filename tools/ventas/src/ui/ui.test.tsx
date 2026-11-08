import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { type Context, fixture, pid } from "./ui-fixture.tsx";

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
describe("Ventas UI", () => {
  it("starts with no illustrative data and navigates all seven sections", async () => {
    fixture().mount();
    expect(await screen.findByText(es.emptyCatalog)).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: es.navigation }).querySelectorAll("button"),
    ).toHaveLength(7);
    expect(screen.getByRole("combobox", { name: es.client })).toHaveValue(es.counter);
    fireEvent.click(
      within(screen.getByRole("navigation")).getByRole("button", { name: es.nav.inventory }),
    );
    expect(await screen.findByText(es.emptyInventory)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: es.nav.settings }));
    expect(screen.getByLabelText(es.businessName)).toHaveValue("");
  });
  it("submits a real product command with integer cents and refreshes the inventory", async () => {
    const f = fixture();
    f.mount();
    await screen.findByText(es.emptyCatalog);
    fireEvent.click(
      within(screen.getByRole("navigation")).getByRole("button", { name: es.nav.inventory }),
    );
    fireEvent.click(screen.getByRole("button", { name: es.addProduct }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(es.name), { target: { value: "Gomitas" } });
    fireEvent.change(within(dialog).getByLabelText(es.category), { target: { value: "Dulces" } });
    fireEvent.change(within(dialog).getByLabelText(es.pricePesos), { target: { value: "18.35" } });
    fireEvent.click(within(dialog).getByRole("button", { name: es.save }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Gomitas")).toBeInTheDocument();
    expect(f.invoke).toHaveBeenCalledWith(
      "execute",
      expect.objectContaining({
        revision: 0,
        key: expect.any(String),
        action: {
          type: "saveProduct",
          product: {
            name: "Gomitas",
            category: "Dulces",
            kind: "simple",
            unit: "piece",
            price: 1835,
            minStock: 0,
          },
        },
      }),
    );
  });
  it("cancels a product dialog without mutating and inherits language, theme and accent", async () => {
    const f = fixture();
    f.mount();
    await screen.findByText(es.emptyCatalog);
    fireEvent.click(
      within(screen.getByRole("navigation")).getByRole("button", { name: es.nav.inventory }),
    );
    fireEvent.click(screen.getByRole("button", { name: es.addProduct }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: es.close }));
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(0);
    await act(async () =>
      f.context({
        theme: "dark",
        accent: "green",
        locale: "en",
        hostVersion: "0.5.0",
        toolVersion: "0.1.0",
      }),
    );
    expect(await screen.findByRole("button", { name: en.addProduct })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute("data-accent", "green");
    expect(document.documentElement.lang).toBe("en");
  });
  it("recovers a saved operation by refreshing only, while blocking stale mutations", async () => {
    const f = fixture();
    f.mount();
    await screen.findByText(es.emptyCatalog);
    fireEvent.click(screen.getByRole("button", { name: es.nav.settings }));
    fireEvent.change(screen.getByLabelText(es.businessName), { target: { value: "Tienda" } });
    const invoke = f.invoke.getMockImplementation();
    if (!invoke) throw new Error("Missing fixture implementation");
    f.invoke.mockImplementationOnce(async (method, params) => {
      const result = await invoke(method, params);
      f.invoke.mockRejectedValueOnce(new Error("snapshot unavailable"));
      return result;
    });
    fireEvent.click(screen.getByRole("button", { name: es.saveSettings }));
    expect(await screen.findByRole("alert")).toHaveTextContent(es.errors.E_REFRESH_REQUIRED);
    expect(screen.getByRole("button", { name: es.saveSettings })).toBeDisabled();
    const form = screen.getByRole("button", { name: es.saveSettings }).closest("form");
    if (!form) throw new Error("Missing settings form");
    fireEvent.submit(form);
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: es.retry }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: es.saveSettings })).toBeEnabled();
    expect(screen.getByLabelText(es.businessName)).toHaveValue("Tienda");
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
    expect(f.invoke.mock.calls.filter(([method]) => method === "snapshot")).toHaveLength(3);
  });
  it("retains the original uncertain command and key when a different form is submitted", async () => {
    const f = fixture();
    f.mount();
    await screen.findByText(es.emptyCatalog);
    fireEvent.click(screen.getByRole("button", { name: es.nav.settings }));
    fireEvent.change(screen.getByLabelText(es.businessName), { target: { value: "Original" } });
    const invoke = f.invoke.getMockImplementation();
    if (!invoke) throw new Error("Missing fixture implementation");
    let saved: unknown;
    f.invoke
      .mockImplementationOnce(async (method, params) => {
        saved = await invoke(method, params);
        throw new Error("response lost after commit");
      })
      .mockImplementationOnce(async () => saved);
    fireEvent.click(screen.getByRole("button", { name: es.saveSettings }));
    expect(await screen.findByRole("alert")).toHaveTextContent(es.errors.E_OPERATION_PENDING);
    const original = f.invoke.mock.calls.find(([method]) => method === "execute")?.[1];
    fireEvent.change(screen.getByLabelText(es.businessName), {
      target: { value: "Changed draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: es.saveSettings }));
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: es.retryOperation }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    const commands = f.invoke.mock.calls.filter(([method]) => method === "execute");
    expect(commands).toHaveLength(2);
    expect(commands[1]?.[1]).toEqual(original);
    expect(f.data.revision).toBe(1);
    expect(screen.getByLabelText(es.businessName)).toHaveValue("Changed draft");
  });
  it("offers preparation rather than purchases for prepared bags", async () => {
    const f = fixture();
    f.data.products.push({
      id: pid,
      name: "Bolsita",
      category: "Dulces",
      kind: "prepared",
      unit: "piece",
      price: 1500,
      minStock: 0,
      stock: 0,
      value: 0,
      lastValue: 0,
      lastQty: 1,
      active: true,
    });
    f.mount();
    await screen.findByText("Bolsita");
    fireEvent.click(
      within(screen.getByRole("navigation")).getByRole("button", { name: es.nav.inventory }),
    );
    expect(screen.queryByRole("button", { name: es.receive })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: es.prepare })).toBeInTheDocument();
  });
  it("keeps a newer context event when the initial response arrives late", async () => {
    const f = fixture();
    let resolveInitial!: (context: Context) => void;
    f.getContext.mockImplementationOnce(
      () =>
        new Promise<Context>((resolve) => {
          resolveInitial = resolve;
        }),
    );
    f.mount();
    await screen.findByText(es.emptyCatalog);
    await act(async () =>
      f.context({
        theme: "dark",
        accent: "green",
        locale: "en",
        hostVersion: "0.5.0",
        toolVersion: "0.1.0",
      }),
    );
    expect(await screen.findByRole("navigation", { name: en.navigation })).toBeInTheDocument();
    await act(async () =>
      resolveInitial({
        theme: "light",
        accent: "blue",
        locale: "es",
        hostVersion: "0.5.0",
        toolVersion: "0.1.0",
      }),
    );
    expect(screen.getByRole("navigation", { name: en.navigation })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute("data-accent", "green");
    expect(document.documentElement.lang).toBe("en");
    expect(f.getContext).toHaveBeenCalledTimes(1);
  });
  it("finishes a failed initial load and retries without restarting the tool", async () => {
    const f = fixture();
    f.invoke.mockRejectedValueOnce(new Error("database unavailable"));
    f.mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(es.errors.E_INTERNAL);
    expect(screen.queryByText(es.loading)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: es.retry }));
    expect(await screen.findByText(es.emptyCatalog)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(f.invoke.mock.calls.filter(([method]) => method === "snapshot")).toHaveLength(2);
  });
});
