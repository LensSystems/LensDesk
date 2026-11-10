import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, expect, it } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { ProductIcon } from "./ProductIcon.tsx";
import { fixture } from "./ui-fixture.tsx";

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
function seeded() {
  const f = fixture();
  for (const [i, category] of [
    "Pan",
    "Otra",
    "Dulces",
    "Bebidas",
    "Frituras",
    "Semillas",
    "__all",
  ].entries())
    f.data.products.push({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      name: `Producto ${i}`,
      category,
      kind: "simple",
      unit: "piece",
      price: 100,
      minStock: 5,
      stock: 10,
      value: 500,
      lastValue: 500,
      lastQty: 10,
      active: true,
      icon: i === 0 ? "cookie" : "candy",
    });
  return f;
}
it("retains insertion order and source category priority without confusing a category with all", async () => {
  const f = seeded();
  f.mount();
  await screen.findByRole("button", { name: "Agregar Producto 0" });
  expect(
    screen
      .getAllByRole("button", { name: /^Agregar Producto/ })
      .map((b) => b.getAttribute("aria-label")),
  ).toEqual(f.data.products.map((p) => `Agregar ${p.name}`));
  expect(
    within(screen.getByRole("radiogroup", { name: es.categories }))
      .getAllByRole("radio")
      .map((r) => r.textContent),
  ).toEqual(["Todos", "Dulces", "Frituras", "Pan", "Semillas", "Bebidas", "Otra", "__all"]);
  fireEvent.click(screen.getByRole("radio", { name: "__all" }));
  expect(screen.getAllByRole("button", { name: /^Agregar Producto/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole("radio", { name: es.allCategories }));
  expect(screen.getAllByRole("button", { name: /^Agregar Producto/ })).toHaveLength(7);
  expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(0);
});
it("connects F2/F4 only in sale, keeps client search keyboard behavior and ignores dialogs", async () => {
  const f = seeded();
  f.mount();
  const search = await screen.findByRole("searchbox", { name: es.searchProduct });
  fireEvent.keyDown(document, { key: "F2" });
  expect(search).toHaveFocus();
  fireEvent.change(search, { target: { value: "Producto 0" } });
  fireEvent.keyDown(document, { key: "F4" });
  const client = screen.getByRole("combobox", { name: es.client });
  expect(client).toHaveFocus();
  expect(client).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(client, { key: "Escape" });
  fireEvent.keyDown(document, { key: "F4" });
  expect(client).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: es.addClient }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(document, { key: "F2" });
  fireEvent.keyDown(document, { key: "F4" });
  expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.click(within(dialog).getByRole("button", { name: es.close }));
  expect(search).toHaveValue("Producto 0");
  fireEvent.mouseDown(screen.getByRole("tab", { name: es.nav.inventory }));
  await screen.findByRole("button", { name: es.addProduct });
  const event = new KeyboardEvent("keydown", { key: "F2", bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(f.data.draft.lines).toEqual([]);
  expect(f.data.products.every((p) => p.stock === 10)).toBe(true);
});
it("ignores quick search keys while a draft mutation is unresolved", async () => {
  const f = seeded();
  f.mount();
  await screen.findByRole("button", { name: "Agregar Producto 0" });
  const original = f.invoke.getMockImplementation();
  if (!original) throw Error("Missing invoke");
  let finish!: () => void;
  f.invoke.mockImplementationOnce(async (...args) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return original(...args);
  });
  fireEvent.click(screen.getByRole("button", { name: "Agregar Producto 0" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Agregar Producto 0" })).toBeDisabled(),
  );
  const event = new KeyboardEvent("keydown", { key: "F4", bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(screen.getByRole("combobox", { name: es.client })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await act(async () => finish());
  await waitFor(() =>
    expect(f.data.draft.lines).toEqual([
      { productId: "00000000-0000-4000-8000-000000000000", qty: 1 },
    ]),
  );
  expect(f.data.products[0]?.stock).toBe(10);
});
it("renders prototype names as safe generic icons, never arbitrary markup or remote assets", () => {
  const fallback = render(<ProductIcon icon={null} kind="simple" />),
    html = fallback.container.innerHTML;
  fallback.unmount();
  for (const icon of [
    "__proto__",
    "constructor",
    "toString",
    "<svg onload=alert(1)>",
    "https://example.com/a.svg",
  ]) {
    const view = render(<ProductIcon icon={icon} kind="simple" />);
    expect(view.container.innerHTML).toBe(html);
    expect(view.container.querySelector("img, script, use")).toBeNull();
    view.unmount();
  }
});

it("starts client navigation without a highlighted choice and returns focus after creation is cancelled", async () => {
  const f = seeded();
  const ids = ["00000000-0000-4000-8000-000000000011", "00000000-0000-4000-8000-000000000012"];
  for (const [index, name] of ["Berta", "Ana"].entries()) {
    const id = ids[index];
    if (!id) throw Error("Missing ID");
    f.data.clients.push({ id, name, phone: "", term: 15, limit: null, active: true });
    f.data.accounts.push({ clientId: id, balance: 0, overdue: 0, nextDue: null, totalPaid: 0 });
  }
  f.mount();
  await screen.findByRole("searchbox", { name: es.searchProduct });
  fireEvent.keyDown(document, { key: "F4" });
  const client = screen.getByRole("combobox", { name: es.client });
  expect(client).not.toHaveAttribute("aria-activedescendant");
  fireEvent.keyDown(client, { key: "ArrowDown" });
  expect(
    document.getElementById(client.getAttribute("aria-activedescendant") ?? ""),
  ).toHaveTextContent(es.counter);
  fireEvent.keyDown(client, { key: "Escape" });
  fireEvent.keyDown(document, { key: "F4" });
  fireEvent.keyDown(client, { key: "ArrowUp" });
  expect(
    document.getElementById(client.getAttribute("aria-activedescendant") ?? ""),
  ).toHaveTextContent("Ana");
  fireEvent.change(client, { target: { value: "Berta" } });
  expect(client).not.toHaveAttribute("aria-activedescendant");
  fireEvent.keyDown(client, { key: "Enter" });
  await waitFor(() => expect(f.data.draft.clientId).toBe(ids[0]));
  await waitFor(() => expect(client).toBeEnabled());
  fireEvent.keyDown(document, { key: "F4" });
  fireEvent.change(client, { target: { value: "ZZZ" } });
  fireEvent.keyDown(client, { key: "Enter" });
  let dialog = await screen.findByRole("dialog");
  expect(client).toHaveAttribute("aria-expanded", "false");
  expect(document.querySelector(".ventas-sale-customer-popup")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: es.close }));
  await waitFor(() => expect(client).toHaveFocus());
  expect(client).toHaveAttribute("aria-expanded", "false");
  fireEvent.keyDown(document, { key: "F4" });
  fireEvent.click(screen.getByRole("button", { name: es.addClient }));
  dialog = await screen.findByRole("dialog");
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(client).toHaveFocus());
  expect(client).toHaveAttribute("aria-expanded", "false");
  fireEvent.keyDown(document, { key: "F4" });
  expect(client).toHaveAttribute("aria-expanded", "true");
  expect(
    f.invoke.mock.calls.filter(
      ([method, params]) =>
        method === "execute" &&
        (params as { action?: { type?: string } })?.action?.type === "saveClient",
    ),
  ).toHaveLength(0);
});
it("keeps cancellation and confirmed clearing unchanged for the default operation modal without a focus callback", async () => {
  const f = seeded(),
    product = f.data.products[0];
  if (!product) throw Error("Missing product");
  f.data.draft.lines = [{ productId: product.id, qty: 1 }];
  f.mount();
  await screen.findByRole("button", { name: es.clearCart });
  fireEvent.click(screen.getByRole("button", { name: es.clearCart }));
  let dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: es.close }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(f.data.draft.lines).toEqual([{ productId: product.id, qty: 1 }]);
  expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: es.clearCart }));
  dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: es.clearCart }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(f.data.draft.lines).toEqual([]);
  expect(product.stock).toBe(10);
  expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
});
it("prefills the searched name and waits through client and draft refreshes before returning focus", async () => {
  const f = seeded(),
    first = f.data.products[0],
    id = "00000000-0000-4000-8000-000000000021";
  if (!first) throw Error("Missing product");
  f.data.draft.lines = [{ productId: first.id, qty: 2 }];
  f.mount();
  await screen.findByRole("searchbox", { name: es.searchProduct });
  const original = f.invoke.getMockImplementation();
  if (!original) throw Error("Missing invoke");
  const releases: Array<() => void> = [];
  f.invoke.mockImplementation(async (method, params) => {
    if (method === "snapshot")
      await new Promise<void>((resolve) => {
        releases.push(resolve);
      });
    if (
      method === "execute" &&
      (params as { action: { type: string } }).action.type === "saveClient"
    ) {
      const input = (
        params as {
          action: { client: { name: string; phone: string; term: number; limit: number | null } };
        }
      ).action.client;
      f.data.clients.push({ ...input, id, active: true });
      f.data.accounts.push({ clientId: id, balance: 0, overdue: 0, nextDue: null, totalPaid: 0 });
      f.data.revision++;
      return { kind: "ok", value: { id, revision: f.data.revision } };
    }
    return original(method, params);
  });
  fireEvent.keyDown(document, { key: "F4" });
  const client = screen.getByRole("combobox", { name: es.client });
  fireEvent.change(client, { target: { value: "Nuevo cliente" } });
  fireEvent.keyDown(client, { key: "Enter" });
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByLabelText(es.clientName)).toHaveValue("Nuevo cliente");
  fireEvent.click(within(dialog).getByRole("button", { name: es.addClient }));
  await waitFor(() => expect(releases).toHaveLength(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(client).toBeDisabled();
  expect(client).not.toHaveFocus();
  await act(async () => releases[0]?.());
  await waitFor(() => expect(releases).toHaveLength(2));
  expect(client).toBeDisabled();
  expect(client).not.toHaveFocus();
  await act(async () => releases[1]?.());
  await waitFor(() => expect(client).toHaveFocus());
  expect(client).toBeEnabled();
  expect(client).toHaveValue("Nuevo cliente");
  expect(client).toHaveAttribute("aria-expanded", "false");
  expect(f.data.draft).toEqual({ clientId: id, lines: [{ productId: first.id, qty: 2 }] });
  expect(first.stock).toBe(10);
  expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(2);
});
it("focuses one operational retry during failed reconciliation and completes the pending return after recovery", async () => {
  const f = seeded();
  f.mount();
  const search = await screen.findByRole("searchbox", { name: es.searchProduct });
  const original = f.invoke.getMockImplementation();
  if (!original) throw Error("Missing invoke");
  let failSnapshot = true;
  f.invoke.mockImplementation(async (method, params) => {
    if (method === "execute") return { kind: "rejected", issue: { code: "E_CLIENT_NAME" } };
    if (method === "snapshot" && failSnapshot) throw Error("Snapshot unavailable after rejection");
    return original(method, params);
  });
  fireEvent.keyDown(document, { key: "F4" });
  const client = screen.getByRole("combobox", { name: es.client });
  fireEvent.change(client, { target: { value: "Intento" } });
  fireEvent.keyDown(client, { key: "Enter" });
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: es.addClient }));
  await waitFor(() =>
    expect(within(dialog).getByRole("alert")).toHaveTextContent(es.errors.E_RELOAD_REQUIRED),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: es.close }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  const retry = within(screen.getByRole("alert")).getByRole("button", { name: es.retry });
  await waitFor(() => expect(retry).toHaveFocus());
  expect(client).toBeDisabled();
  expect(client).toHaveAttribute("aria-expanded", "false");
  search.focus();
  expect(search).toHaveFocus();
  await act(async () =>
    f.context({
      theme: "dark",
      accent: "blue",
      locale: "es",
      hostVersion: "0.5.0",
      toolVersion: "0.1.0",
    }),
  );
  expect(search).toHaveFocus();
  failSnapshot = false;
  fireEvent.click(retry);
  await waitFor(() => expect(client).toHaveFocus());
  expect(client).toBeEnabled();
  expect(client).toHaveAttribute("aria-expanded", "false");
  expect(f.data.clients).toEqual([]);
  expect(f.data.draft.lines).toEqual([]);
  expect(f.data.products.every((p) => p.stock === 10)).toBe(true);
  expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
});
