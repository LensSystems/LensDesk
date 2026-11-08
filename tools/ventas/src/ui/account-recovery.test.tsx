import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it } from "vitest";
import es from "../../locales/es.json";
import { fixture } from "./ui-fixture.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ resources: { es: { translation: es } }, lng: "es" });
});
for (const fail of [false, true])
  it(`keeps exact account sale pending until refreshed snapshot${fail ? " after error/retry" : ""}, preserving cart`, async () => {
    const f = fixture(),
      ids = [crypto.randomUUID(), crypto.randomUUID()];
    for (const [i, id] of ids.entries()) {
      f.data.clients.push({
        id,
        name: `Cliente ${i}`,
        phone: "",
        term: 15,
        limit: null,
        active: true,
      });
      f.data.accounts.push({ clientId: id, balance: 0, overdue: 0, nextDue: null, totalPaid: 0 });
    }
    const productId = crypto.randomUUID();
    f.data.products.push({
      id: productId,
      name: "Concha",
      category: "Pan",
      kind: "simple",
      unit: "piece",
      price: 100,
      minStock: 0,
      stock: 5,
      value: 100,
      lastValue: 100,
      lastQty: 5,
      active: true,
    });
    const cart = [{ productId, qty: 1 }];
    f.data.draft = { clientId: ids[0] ?? null, lines: cart };
    f.mount();
    await screen.findByRole("heading", { name: es.currentSale });
    fireEvent.mouseDown(screen.getByRole("tab", { name: es.nav.accounts }));
    fireEvent.click(screen.getByRole("button", { name: /Cliente 1/ }));
    const base = f.invoke.getMockImplementation();
    if (!base) throw Error("Fixture missing");
    let release: ((value: unknown) => void) | undefined;
    let reject: ((reason: Error) => void) | undefined;
    f.invoke.mockImplementation(async (method, params) =>
      method === "snapshot"
        ? new Promise((resolve, fail) => {
            release = resolve;
            reject = fail;
          })
        : base(method, params),
    );
    fireEvent.click(screen.getByRole("button", { name: es.newSale }));
    await waitFor(() => expect(release).toBeDefined());
    expect(screen.getByRole("tab", { name: es.nav.accounts })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: es.statement })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: es.newSale }));
    expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(1);
    if (fail) {
      await act(async () => reject?.(Error("Refresh failed")));
      await screen.findByRole("alert");
      expect(screen.getByRole("tab", { name: es.nav.accounts })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      f.invoke.mockImplementation(base);
      fireEvent.click(screen.getByRole("button", { name: es.retry }));
    } else await act(async () => release?.({ kind: "ok", value: structuredClone(f.data) }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: es.nav.sale })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(f.data.draft.clientId).toBe(ids[1]);
    expect(f.data.draft.lines).toEqual(cart);
    expect(screen.getByRole("combobox", { name: es.client })).toHaveValue("Cliente 1");
    expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(1);
  });
