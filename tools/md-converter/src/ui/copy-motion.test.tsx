import { TooltipProvider } from "@lensdesk/ui";
import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { Preview } from "./Preview.tsx";

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return { width: this.classList.contains("copy-confirmation") ? 96 : 32 } as DOMRect;
  });
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("libera el ancho tras ambas transiciones y reinicia los dos segundos al copiar otra vez", async () => {
  render(
    <TooltipProvider>
      <Preview
        client={{ ui: { copyText: async () => {} } } as never}
        item={
          {
            id: "one",
            status: "done",
            markdown: "# Texto",
            warnings: [],
            file: { name: "a.html" },
          } as never
        }
        results={[]}
        onSaved={() => {}}
      />
    </TooltipProvider>,
  );
  // React monta un botón nuevo al cambiar de estado: se busca el vigente en cada paso.
  const button = () =>
    (screen.queryByRole("button", { name: es.copy }) ??
      screen.getByRole("button", { name: "Copiado" })) as HTMLButtonElement;
  const mounted = button();
  await act(async () => fireEvent.click(button()));
  // El botón no se desmonta: conserva el foco y la transición.
  expect(button()).toBe(mounted);
  expect(button().style.width).toBe("96px");
  expect(button().querySelectorAll(".copia-saliente")).toHaveLength(1);
  act(() => vi.advanceTimersByTime(75));
  await act(async () => fireEvent.click(button()));
  expect(button().style.width).toBe("");
  expect(button().querySelectorAll(".copia-saliente")).toHaveLength(0);
  act(() => vi.advanceTimersByTime(1999));
  expect(button()).toHaveAttribute("aria-label", "Copiado");
  act(() => vi.advanceTimersByTime(1));
  expect(button()).toHaveAttribute("aria-label", es.copy);
  expect(button().style.width).toBe("32px");
  act(() => vi.advanceTimersByTime(150));
  expect(button().style.width).toBe("");
  expect(button().querySelector(".copia-saliente")).toBeNull();
});

it("cambia al instante cuando se reduce el movimiento", async () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  render(
    <TooltipProvider>
      <Preview
        client={{ ui: { copyText: async () => {} } } as never}
        item={
          {
            id: "one",
            status: "done",
            markdown: "# Texto",
            warnings: [],
            file: { name: "a.html" },
          } as never
        }
        results={[]}
        onSaved={() => {}}
      />
    </TooltipProvider>,
  );
  const button = screen.getByRole("button", { name: es.copy }) as HTMLButtonElement;
  await act(async () => fireEvent.click(button));
  const copied = screen.getByRole("button", { name: "Copiado" });
  expect(copied.style.width).toBe("");
  expect(copied.dataset.copyMotion).toBeUndefined();
});
