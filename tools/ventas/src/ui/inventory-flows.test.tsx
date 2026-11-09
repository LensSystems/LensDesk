import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import type { Product } from "../shared/contracts.ts";
import { fixture, pid } from "./ui-fixture.tsx";

const base: Product = {
  id: pid,
  name: "Simple",
  category: "Test",
  kind: "simple",
  unit: "piece",
  price: 100,
  minStock: 5,
  stock: 5,
  value: 100,
  lastValue: 100,
  lastQty: 5,
  active: true,
  icon: "cookie",
};
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
async function setup(minimum = 5) {
  const f = fixture();
  f.data.products.push(
    { ...base, minStock: minimum },
    { ...base, id: pid.replace(/0$/, "1"), name: "Inactive", active: false },
    {
      ...base,
      id: pid.replace(/0$/, "2"),
      name: "Material",
      kind: "material",
      unit: "g",
      stock: 10000,
      value: 333,
    },
    { ...base, id: pid.replace(/0$/, "3"), name: "Prepared", kind: "prepared", stock: 0 },
  );
  f.data.recipes.push({
    productId: f.data.products[3]?.id ?? "",
    materialId: f.data.products[2]?.id ?? "",
    grams: 100,
    packagingId: null,
  });
  f.mount();
  await screen.findByText("Simple");
  fireEvent.mouseDown(
    within(screen.getByRole("navigation")).getByRole("tab", { name: es.nav.inventory }),
  );
  return f;
}
describe("inventory controls", () => {
  it("offers native global pickers and preparation defaults while blocking insufficient stock", async () => {
    const f = await setup();
    const actions = screen.getByRole("button", { name: es.addProduct }).parentElement;
    if (!actions) throw new Error("Missing inventory actions");
    fireEvent.click(within(actions).getByRole("button", { name: es.prepareBags }));
    const d = within(screen.getByRole("dialog"));
    expect(d.getByLabelText(es.bagQuantity)).toHaveValue(10);
    expect(d.getByRole("combobox", { name: es.productToPrepare })).toHaveTextContent("Prepared");
    fireEvent.click(d.getByRole("combobox", { name: es.productToPrepare }));
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Prepared" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Prepared" }));
    fireEvent.change(d.getByLabelText(es.bagQuantity), { target: { value: "101" } });
    expect(d.getByRole("button", { name: es.confirmPreparation })).toBeDisabled();
    expect(d.getByRole("alert")).toHaveTextContent(es.errors.E_STOCK);
    const form = d.getByRole("button", { name: es.confirmPreparation }).closest("form");
    if (!form) throw new Error("Missing preparation form");
    fireEvent.submit(form);
    expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(0);
  });
  it("requires activation confirmation and cancelling never writes", async () => {
    const f = await setup();
    const row = within(screen.getByRole("row", { name: /Inactive/ }));
    fireEvent.click(row.getByRole("button", { name: es.activate }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Inactive");
    expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(0);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: es.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(row.getByRole("button", { name: es.activate }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: es.activate }));
    await waitFor(() =>
      expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(1),
    );
    expect(f.invoke.mock.calls.find(([m]) => m === "execute")?.[1]).toMatchObject({
      action: { type: "setActive", id: f.data.products[1]?.id, active: true },
    });
  });
  it("starts new product minimum at five and preserves edit minimum", async () => {
    await setup(0);
    fireEvent.click(screen.getByRole("button", { name: es.addProduct }));
    expect(within(screen.getByRole("dialog")).getByLabelText(es.minStock)).toHaveValue(5);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: es.cancel }));
    fireEvent.click(
      within(screen.getByRole("row", { name: /Simple/ })).getByRole("button", { name: es.edit }),
    );
    expect(within(screen.getByRole("dialog")).getByLabelText(es.minStock)).toHaveValue(0);
  });
  it("receives with a total cost and omits unsupported reference fields", async () => {
    const f = await setup();
    fireEvent.click(screen.getByRole("button", { name: es.receiveGoods }));
    const d = within(screen.getByRole("dialog"));
    expect(d.getByRole("combobox", { name: es.productOrMaterial })).toHaveTextContent("Simple");
    expect(d.queryByLabelText(es.paymentReference)).not.toBeInTheDocument();
    fireEvent.click(d.getByRole("combobox", { name: es.productOrMaterial }));
    expect(screen.queryByRole("option", { name: /Prepared|Inactive/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Material/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Simple/ }));
    fireEvent.change(d.getByLabelText(es.totalCostPesos), { target: { value: "1.01" } });
    fireEvent.click(d.getByRole("button", { name: es.confirm }));
    await waitFor(() =>
      expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(1),
    );
    expect(f.invoke.mock.calls.find(([m]) => m === "execute")?.[1]).toMatchObject({
      action: { type: "receive", productId: pid, qty: 1, cost: 101, method: "cash", bankId: null },
    });
  });
});
