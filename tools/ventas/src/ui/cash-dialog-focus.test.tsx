import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { fixture } from "./ui-fixture.tsx";

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
async function open(origin: "nav" | "panel" | "nav-after-expenses") {
  const f = fixture();
  f.mount();
  await screen.findByText(es.emptyCatalog);
  fireEvent.mouseDown(screen.getByRole("tab", { name: es.nav.expenses }));
  if (origin === "nav-after-expenses")
    fireEvent.mouseDown(screen.getByRole("tab", { name: es.nav.sale }));
  const target = document.querySelector<HTMLButtonElement>(
    `[data-cash-dialog-trigger="${origin === "panel" ? "panel" : "nav"}"]`,
  );
  if (!target) throw new Error("Missing cash origin");
  target.focus();
  fireEvent.click(target);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  return { ...f, target };
}
describe("global cash dialog origin", () => {
  it.each(["nav", "panel", "nav-after-expenses"] as const)(
    "returns to %s after cancel",
    async (origin) => {
      const f = await open(origin);
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: es.cancel }));
      await waitFor(() => expect(f.target).toHaveFocus());
      expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(0);
    },
  );
  it.each(["nav", "panel", "nav-after-expenses"] as const)(
    "defers %s focus until the confirmed snapshot is loaded",
    async (origin) => {
      const f = await open(origin),
        invoke = f.invoke.getMockImplementation();
      if (!invoke) throw new Error("Missing implementation");
      let release: ((value: unknown) => void) | undefined;
      f.invoke.mockImplementationOnce(async (method, params) => {
        const result = await invoke(method, params);
        f.invoke.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              release = resolve;
            }),
        );
        return result;
      });
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: es.openCash }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(f.target).toBeDisabled();
      expect(screen.getByRole("main")).toHaveFocus();
      if (!release) throw new Error("Missing pending snapshot");
      release({ kind: "ok", value: structuredClone(f.data) });
      await waitFor(() => expect(f.target).toHaveFocus());
      expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(1);
    },
  );
  it.each(["nav", "panel", "nav-after-expenses"] as const)(
    "offers operative retry then returns to %s after confirmed refresh fails",
    async (origin) => {
      const f = await open(origin),
        invoke = f.invoke.getMockImplementation();
      if (!invoke) throw new Error("Missing implementation");
      f.invoke.mockImplementationOnce(async (method, params) => {
        const result = await invoke(method, params);
        f.invoke.mockRejectedValueOnce(new Error("snapshot unavailable"));
        return result;
      });
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: es.openCash }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      const retry = await screen.findByRole("button", { name: es.retry });
      await waitFor(() => expect(retry).toHaveFocus());
      expect(f.target).toBeDisabled();
      fireEvent.click(retry);
      await waitFor(() => expect(f.target).toHaveFocus());
      expect(f.invoke.mock.calls.filter(([m]) => m === "execute")).toHaveLength(1);
    },
  );
});
