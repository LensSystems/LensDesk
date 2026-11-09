import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import type { Product } from "../shared/contracts.ts";
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

async function openDialog(kind: "product" | "recipe" | "stock") {
  const f = fixture();
  const base: Product = {
    id: pid,
    name: "Gomitas",
    category: "Dulces",
    kind: "simple",
    unit: "piece",
    price: 1500,
    minStock: 0,
    stock: 0,
    value: 0,
    lastValue: 0,
    lastQty: 1,
    icon: null,
    active: true,
  };
  f.data.products.push(
    base,
    {
      ...base,
      id: "9d44e2be-d3d6-4d73-ad57-65011a4a12d1",
      name: "Materia prima",
      kind: "material",
      unit: "g",
    },
    { ...base, id: "9d44e2be-d3d6-4d73-ad57-65011a4a12d2", name: "Bolsita", kind: "prepared" },
  );
  f.mount();
  await screen.findByText("Gomitas");
  fireEvent.mouseDown(
    within(screen.getByRole("navigation")).getByRole("tab", { name: es.nav.inventory }),
  );
  if (kind === "product") {
    fireEvent.click(screen.getByRole("button", { name: es.addProduct }));
  } else if (kind === "recipe") {
    fireEvent.click(screen.getByRole("button", { name: es.recipe }));
  } else {
    const row = screen.getByRole("row", { name: /Gomitas/ });
    fireEvent.click(within(row).getByRole("button", { name: es.receive }));
  }
  const dialog = screen.getByRole("dialog");
  if (kind === "product") {
    fireEvent.change(within(dialog).getByLabelText(es.name), { target: { value: "Nuevo" } });
    fireEvent.change(within(dialog).getByLabelText(es.category), { target: { value: "Dulces" } });
  }
  return { ...f, dialog, submitLabel: kind === "stock" ? es.confirm : es.save };
}

describe("Ventas modal recovery", () => {
  it.each(["product", "recipe", "stock"] as const)(
    "announces %s rejection inside the modal after a successful refresh",
    async (kind) => {
      const f = await openDialog(kind);
      f.invoke.mockResolvedValueOnce({ kind: "rejected", issue: { code: "E_STOCK" } });
      fireEvent.click(within(f.dialog).getByRole("button", { name: f.submitLabel }));
      expect(await within(f.dialog).findByRole("alert")).toHaveTextContent(es.errors.E_STOCK);
      await waitFor(() =>
        expect(within(f.dialog).getByRole("button", { name: f.submitLabel })).toBeEnabled(),
      );
      expect(within(f.dialog).getByRole("button", { name: es.close })).toBeEnabled();
    },
  );
  it.each(["product", "recipe", "stock"] as const)(
    "recovers %s rejected write and failed refresh from inside the modal",
    async (kind) => {
      const f = await openDialog(kind);
      f.invoke
        .mockResolvedValueOnce({ kind: "rejected", issue: { code: "E_STOCK" } })
        .mockRejectedValueOnce(new Error("snapshot unavailable"));
      fireEvent.click(within(f.dialog).getByRole("button", { name: f.submitLabel }));
      await waitFor(() =>
        expect(within(f.dialog).getByRole("alert")).toHaveTextContent(es.errors.E_RELOAD_REQUIRED),
      );
      expect(within(f.dialog).getByRole("button", { name: f.submitLabel })).toBeDisabled();
      expect(within(f.dialog).getByRole("button", { name: es.close })).toBeEnabled();
      fireEvent.click(within(f.dialog).getByRole("button", { name: es.retry }));
      await waitFor(() => expect(within(f.dialog).queryByRole("alert")).not.toBeInTheDocument());
      expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
      fireEvent.click(within(f.dialog).getByRole("button", { name: f.submitLabel }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(2);
    },
  );
  it("allows safe modal exit while refresh is blocked without enabling stale writes", async () => {
    const f = await openDialog("product");
    f.invoke
      .mockResolvedValueOnce({ kind: "rejected", issue: { code: "E_STOCK" } })
      .mockRejectedValueOnce(new Error("snapshot unavailable"));
    fireEvent.click(within(f.dialog).getByRole("button", { name: es.save }));
    await waitFor(() =>
      expect(within(f.dialog).getByRole("alert")).toHaveTextContent(es.errors.E_RELOAD_REQUIRED),
    );
    fireEvent.click(within(f.dialog).getByRole("button", { name: es.close }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: es.addProduct }));
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: es.save }),
    ).toBeDisabled();
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
  });
  it.each([
    [false, false],
    [true, false],
    [true, true],
  ])(
    "recovers lost stock response once, preserves edited draft=%s, failed refresh=%s and prevents repeat confirmation",
    async (edited, failedRefresh) => {
      const f = await openDialog("stock");
      const invoke = f.invoke.getMockImplementation();
      if (!invoke) throw new Error("Missing fixture implementation");
      let saved: unknown;
      f.invoke
        .mockImplementationOnce(async (method, params) => {
          saved = await invoke(method, params);
          throw new Error("response lost after commit");
        })
        .mockImplementationOnce(async () => saved);
      fireEvent.click(within(f.dialog).getByRole("button", { name: es.confirm }));
      expect(await within(f.dialog).findByRole("alert")).toHaveTextContent(
        es.errors.E_OPERATION_PENDING,
      );
      const original = f.invoke.mock.calls.find(([method]) => method === "execute")?.[1];
      if (edited)
        fireEvent.change(within(f.dialog).getByLabelText(es.quantity), { target: { value: "2" } });
      if (failedRefresh) f.invoke.mockRejectedValueOnce(new Error("snapshot unavailable"));
      fireEvent.click(within(f.dialog).getByRole("button", { name: es.retryOperation }));
      if (edited) {
        expect(await within(f.dialog).findByRole("status")).toHaveTextContent(
          es.savedPreviousDraft,
        );
        if (failedRefresh) {
          await waitFor(() =>
            expect(within(f.dialog).getByRole("alert")).toHaveTextContent(
              es.errors.E_REFRESH_REQUIRED,
            ),
          );
          fireEvent.click(within(f.dialog).getByRole("button", { name: es.retry }));
          await waitFor(() =>
            expect(within(f.dialog).queryByRole("alert")).not.toBeInTheDocument(),
          );
        }
        expect(within(f.dialog).getByLabelText(es.quantity)).toHaveValue(2);
        expect(within(f.dialog).getByRole("button", { name: es.confirm })).toBeDisabled();
        const form = within(f.dialog).getByRole("button", { name: es.confirm }).closest("form");
        if (!form) throw new Error("Missing stock form");
        fireEvent.submit(form);
        fireEvent.click(within(f.dialog).getByRole("button", { name: es.close }));
      }
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      const commands = f.invoke.mock.calls.filter(([method]) => method === "execute");
      expect(commands).toHaveLength(2);
      expect(commands[1]?.[1]).toEqual(original);
      expect(f.data.revision).toBe(1);
    },
  );
});
