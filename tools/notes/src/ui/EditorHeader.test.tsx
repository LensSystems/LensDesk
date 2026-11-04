import { TooltipProvider } from "@lensdesk/ui";
import { act, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { EditorHeader } from "./EditorHeader.tsx";
import { SaveStatus } from "./SaveStatus.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});

it("anuncia guardando y guardado con cortesía sin anunciar cada borrador pendiente", async () => {
  const { rerender } = render(<SaveStatus phase="idle" />);
  const live = screen.getByRole("status");
  expect(live).toHaveAttribute("aria-live", "polite");
  expect(live).toHaveAttribute("aria-atomic", "true");
  const changed = vi.fn();
  const observer = new MutationObserver(changed);
  observer.observe(live, { childList: true, characterData: true, subtree: true });
  try {
    rerender(<SaveStatus phase="pending" />);
    rerender(<SaveStatus phase="pending" />);
    await act(async () => {});
    expect(live).toBeEmptyDOMElement();
    expect(changed).not.toHaveBeenCalled();
    rerender(<SaveStatus phase="saving" />);
    expect(live).toHaveTextContent("Guardando…");
    rerender(<SaveStatus phase="saved" />);
    expect(live).toHaveTextContent("Guardado");
    expect(screen.getByRole("status")).toBe(live);
  } finally {
    observer.disconnect();
  }
});

it.each([false, true])(
  "muestra la privacidad y las medidas de cabecera (privada: %s)",
  (privateNote) => {
    render(
      <TooltipProvider>
        <EditorHeader
          note={{
            id: "1",
            title: "Título",
            body_md: "",
            pinned: false,
            private: privateNote,
            created_at: "now",
            updated_at: "now",
            deleted_at: null,
          }}
          preview={false}
          locked={false}
          onMode={vi.fn()}
          onBlur={vi.fn()}
          onCopy={vi.fn(async () => true)}
          onExport={vi.fn()}
          onRename={vi.fn(async () => {})}
        />
      </TooltipProvider>,
    );
    expect(screen.getByRole("heading", { name: "Título" })).toHaveClass(
      "text-[18px]",
      "leading-7",
      "font-bold",
    );
    const privacy = screen.getByRole("button", {
      name: i18n.t(privateNote ? "vault.remove" : "vault.makePrivate"),
    });
    expect(privacy).toHaveAttribute("aria-pressed", String(privateNote));
    expect(privacy.querySelector("svg")).toHaveClass(
      privateNote ? "lucide-lock" : "lucide-lock-open",
    );
    expect(privacy.querySelector("svg")).toHaveAttribute("width", "16");
    expect(screen.getByRole("banner")).toHaveClass(
      "h-[57px]",
      "px-4",
      "py-3",
      "@max-[960px]/notes:h-[51px]",
    );
    expect(screen.getByRole("radiogroup", { name: "Modo" })).toHaveClass(
      "h-8",
      "p-0.5",
      "@max-[960px]/notes:border",
    );
    for (const button of screen.getAllByRole("radio")) {
      expect(button).toHaveClass(
        "h-7",
        "px-3.5",
        "font-normal",
        "@max-[960px]/notes:w-8",
        "data-[state=checked]:shadow-[0_1px_2px_rgb(0_0_0_/_0.25)]",
      );
      expect(button.querySelector("svg")).toHaveAttribute("width", "13");
    }
  },
);
