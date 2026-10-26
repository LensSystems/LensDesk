import { TooltipProvider } from "@lensdesk/ui";
import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { EditorHeader } from "./EditorHeader.tsx";
import { NotePreview } from "./NotePreview.tsx";

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

it.each(["cabecera", "código", "credencial"])(
  "%s: libera el ancho tras ambas transiciones y reinicia los dos segundos al copiar otra vez",
  async (kind) => {
    if (kind === "cabecera") {
      render(
        <TooltipProvider>
          <EditorHeader
            note={{ title: "Nota" } as never}
            preview={false}
            locked={false}
            onMode={() => {}}
            onBlur={() => {}}
            onCopy={async () => true}
            onExport={() => {}}
            onRename={async () => {}}
          />
        </TooltipProvider>,
      );
    } else {
      render(
        <NotePreview
          privateNote
          body={
            kind === "código"
              ? "```ts\nx\n```"
              : '```credential\n{"user":"ada","password":"clave","note":"","fields":[]}\n```'
          }
          onCopyCode={async () => {}}
        />,
      );
    }
    const label =
      kind === "cabecera" ? "Copiar nota" : kind === "código" ? "Copiar código" : "Copiar Usuario";
    // React monta un botón nuevo al cambiar de estado: se busca el vigente en cada paso.
    const button = () =>
      (screen.queryByRole("button", { name: label }) ??
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
    expect(button()).toHaveAttribute("aria-label", label);
    expect(button().style.width).toBe("32px");
    act(() => vi.advanceTimersByTime(150));
    expect(button().style.width).toBe("");
    expect(button().querySelector(".copia-saliente")).toBeNull();
  },
);

it("cambia al instante cuando se reduce el movimiento", async () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  render(<NotePreview body={"```ts\nx\n```"} onCopyCode={async () => {}} />);
  const button = screen.getByRole("button", { name: "Copiar código" }) as HTMLButtonElement;
  await act(async () => fireEvent.click(button));
  const copied = screen.getByRole("button", { name: "Copiado" });
  expect(copied.style.width).toBe("");
  expect(copied.dataset.copyMotion).toBeUndefined();
});
