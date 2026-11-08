import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { useState } from "react";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import type { Command } from "../shared/contracts.ts";
import { CustomerPicker } from "./CustomerPicker.tsx";
import { moneyText, parseMoney } from "./format.ts";
import { MoneyInput } from "./MoneyInput.tsx";
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
const cid = "9d44e2be-d3d6-4d73-ad57-65011a4a12d4";
function store() {
  const f = fixture();
  f.data.products.push({
    id: pid,
    name: "Gomitas",
    category: "Dulces",
    kind: "simple",
    unit: "piece",
    price: 123450,
    minStock: 0,
    stock: 10,
    value: 1000,
    lastValue: 1000,
    lastQty: 10,
    active: true,
  });
  f.data.clients.push({
    id: cid,
    name: "Tienda Lupe",
    phone: "",
    term: 15,
    limit: 200000,
    active: true,
  });
  f.data.accounts.push({
    clientId: cid,
    balance: 0,
    overdue: 0,
    nextDue: null,
    totalPaid: 0,
  });
  f.data.cash = {
    id: "9d44e2be-d3d6-4d73-ad57-65011a4a12d5",
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
    date: "2026-11-07",
  };
  return f;
}
async function add(f: ReturnType<typeof fixture>) {
  f.mount();
  fireEvent.click(
    await screen.findByRole("button", { name: es.addNamedProduct.replace("{{name}}", "Gomitas") }),
  );
  await waitFor(() => expect(f.data.draft.lines).toHaveLength(1));
  await waitFor(() => expect(screen.getByRole("button", { name: es.checkout })).toBeEnabled());
}
async function confirmCheckout(f: ReturnType<typeof fixture>) {
  await add(f);
  fireEvent.click(screen.getByRole("button", { name: es.checkout }));
  fireEvent.click(screen.getByRole("button", { name: es.confirmSale }));
  return screen.getByRole("dialog");
}
function MoneyHarness() {
  const [value, setValue] = useState("");
  return <MoneyInput label="Money" value={value} onChange={setValue} />;
}

describe("Ventas task 2 UI", () => {
  it("formats typed and pasted money with commas, decimal point and stable logical caret", () => {
    render(<MoneyHarness />);
    const input = screen.getByLabelText("Money") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1234", selectionStart: 4 } });
    expect(input).toHaveValue("1,234");
    expect(input.selectionStart).toBe(5);
    fireEvent.change(input, { target: { value: "1,234.", selectionStart: 6 } });
    expect(input).toHaveValue("1,234.");
    expect(input.selectionStart).toBe(6);
    fireEvent.change(input, { target: { value: "12,345.67", selectionStart: 9 } });
    expect(input).toHaveValue("12,345.67");
    expect(input.selectionStart).toBe(9);
    fireEvent.change(input, { target: { value: "192,345.67", selectionStart: 2 } });
    expect(input).toHaveValue("192,345.67");
    expect(input.selectionStart).toBe(2);
    input.setSelectionRange(4, 4);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(input).toHaveValue("19,345.67");
    expect(input.selectionStart).toBe(2);
    expect(parseMoney("12,345.67")).toBe(1234567);
    expect(parseMoney("12.345,67")).toBeNaN();
    expect(parseMoney("90,000,000,000.01")).toBeNaN();
    expect(moneyText(1234567, "es")).toContain("12,345.67");
  });
  it("opens client options over the layout, searches with keyboard and restores selected identity on Escape", async () => {
    const f = store();
    let chosen: string | null = null;
    render(
      <CustomerPicker
        clients={f.data.clients}
        accounts={f.data.accounts}
        value={null}
        onChange={(value) => {
          chosen = value;
        }}
        onCreate={() => {}}
        disabled={false}
      />,
    );
    const picker = screen.getByRole("combobox");
    fireEvent.focus(picker);
    expect(picker).toHaveAttribute("aria-expanded", "true");
    fireEvent.change(picker, { target: { value: "Lupe" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(picker, { key: "ArrowDown" });
    fireEvent.keyDown(picker, { key: "Enter" });
    expect(chosen).toBe(cid);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: "missing" } });
    expect(screen.getByRole("status")).toHaveTextContent(es.noMatchingClients);
    fireEvent.keyDown(picker, { key: "Escape" });
    expect(picker).toHaveValue(es.counter);
    expect(picker).toHaveAttribute("aria-expanded", "false");
  });
  it("persists a cart and selected client without stock reservation, then sends credit confirmation", async () => {
    const f = store();
    await add(f);
    expect(f.data.products[0]?.stock).toBe(10);
    expect(await screen.findByText("1 pieza · 1 producto")).toBeInTheDocument();
    const picker = screen.getByRole("combobox", { name: es.client });
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: "Lupe" } });
    fireEvent.keyDown(picker, { key: "Enter" });
    await waitFor(() => expect(f.data.draft.clientId).toBe(cid));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: es.chargeAccount })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: es.chargeAccount }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Tienda Lupe")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: es.confirmSale }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const command = f.invoke.mock.calls
      .filter(([method]) => method === "execute")
      .at(-1)?.[1] as Command;
    expect(command.action).toMatchObject({
      type: "sell",
      expectedTotal: 123450,
      payment: { amount: 0 },
    });
    expect(f.data.draft.lines).toEqual([]);
  });
  it("keeps persisted cart and payment draft after a rejected sale and allows recovery inside confirmation", async () => {
    const f = store(),
      dialog = await confirmCheckout(f);
    f.invoke.mockResolvedValueOnce({ kind: "rejected", issue: { code: "E_STOCK" } });
    fireEvent.click(within(dialog).getByRole("button", { name: es.confirmSale }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(es.errors.E_STOCK);
    expect(f.data.draft.lines).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: es.close }));
    expect(screen.getByLabelText(es.appliedPayment)).toHaveValue("1,234.50");
    expect(screen.getByRole("button", { name: es.backToSale })).toBeInTheDocument();
  });
  it("retains an uncertain sale and retries identical key without duplicate confirmation or premature cart clearing", async () => {
    const f = store(),
      dialog = await confirmCheckout(f),
      invoke = f.invoke.getMockImplementation();
    if (!invoke) throw new Error("fixture missing");
    let response: unknown;
    f.invoke
      .mockImplementationOnce(async (method, params) => {
        response = await invoke(method, params);
        throw new Error("lost after commit");
      })
      .mockImplementationOnce(async () => response);
    fireEvent.click(within(dialog).getByRole("button", { name: es.confirmSale }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      es.errors.E_OPERATION_PENDING,
    );
    const first = f.invoke.mock.calls.filter(([method]) => method === "execute").at(-1)?.[1];
    expect(within(dialog).getByRole("button", { name: es.confirmSale })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: es.retryOperation }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const commands = f.invoke.mock.calls.filter(([method]) => method === "execute");
    expect(commands.at(-1)?.[1]).toEqual(first);
    expect(f.data.revision).toBe(2);
    expect(f.data.draft.lines).toEqual([]);
    expect(screen.queryByRole("button", { name: es.confirmSale })).not.toBeInTheDocument();
  });
  it("blocks stale cart actions after confirmed sale and failed refresh until snapshot recovery", async () => {
    const f = store(),
      dialog = await confirmCheckout(f),
      invoke = f.invoke.getMockImplementation();
    if (!invoke) throw new Error("fixture missing");
    f.invoke.mockImplementationOnce(async (method, params) => {
      const result = await invoke(method, params);
      f.invoke.mockRejectedValueOnce(new Error("snapshot failed"));
      return result;
    });
    fireEvent.click(within(dialog).getByRole("button", { name: es.confirmSale }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("alert")).toHaveTextContent(es.errors.E_REFRESH_REQUIRED);
    expect(screen.getByRole("button", { name: es.checkout })).toBeDisabled();
    const count = f.invoke.mock.calls.filter(([method]) => method === "execute").length;
    fireEvent.click(screen.getByRole("button", { name: es.checkout }));
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(count);
    fireEvent.click(screen.getByRole("button", { name: es.retry }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(f.data.draft.lines).toEqual([]);
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(count);
  });
  it("serializes rapid cart taps and keeps the saved snapshot authoritative", async () => {
    const f = store();
    f.mount();
    const button = await screen.findByRole("button", {
      name: es.addNamedProduct.replace("{{name}}", "Gomitas"),
    });
    const invoke = f.invoke.getMockImplementation();
    if (!invoke) throw new Error("fixture missing");
    let release: () => void = () => {};
    f.invoke.mockImplementationOnce(async (method, params) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return invoke(method, params);
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
    expect(f.data.draft.lines).toEqual([]);
    await act(async () => release());
    await waitFor(() => expect(f.data.draft.lines).toEqual([{ productId: pid, qty: 1 }]));
    expect(f.data.products[0]?.stock).toBe(10);
  });
});
