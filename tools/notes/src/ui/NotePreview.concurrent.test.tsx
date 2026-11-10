import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { Suspense, startTransition, useState } from "react";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { NotePreview } from "./NotePreview.tsx";

beforeEach(async () => {
  vi.useFakeTimers();
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
afterEach(() => vi.useRealTimers());

it.each([false, true])(
  "conserva la copia del contenido visible durante un render suspendido; respuesta pendiente=%s",
  async (pendingCopy) => {
    let change!: () => void;
    let resume!: () => void;
    let copied!: () => void;
    let ready = false;
    const suspended = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const copyResult = new Promise<void>((resolve) => {
      copied = resolve;
    });
    const copy = vi.fn(() => (pendingCopy ? copyResult : Promise.resolve()));
    function Wait({ changed }: { changed: boolean }) {
      if (changed && !ready) throw suspended;
      return null;
    }
    function Preview() {
      const [changed, setChanged] = useState(false);
      change = () => startTransition(() => setChanged(true));
      return (
        <Suspense fallback={<div>Esperando</div>}>
          <NotePreview
            privateNote
            body={`\`\`\`credential\nuser: ${changed ? "Bea" : "Ada"}\npassword: secreto-sintetico\n\`\`\``}
            onCopyCode={copy}
          />
          <Wait changed={changed} />
        </Suspense>
      );
    }
    const { container } = render(<Preview />);
    const button = screen.getByRole("button", { name: "Copiar Usuario" });
    button.focus();
    await act(async () => fireEvent.click(button));
    expect(copy).toHaveBeenLastCalledWith("Ada");
    await act(async () => change());
    expect(screen.queryByText("Esperando")).toBeNull();
    expect(screen.getByText("Ada")).toBeVisible();
    expect(screen.queryByText("Bea")).toBeNull();
    expect(button).toHaveFocus();
    if (pendingCopy) await act(async () => copied());
    expect(button).toHaveAccessibleName("Copiado");
    act(() => vi.advanceTimersByTime(1999));
    expect(button).toHaveAccessibleName("Copiado");
    act(() => vi.advanceTimersByTime(1));
    expect(button).toHaveAccessibleName("Copiar Usuario");
    expect(button).toHaveFocus();
    expect(container.innerHTML).not.toContain("secreto-sintetico");

    // El render pendiente ahora sí se confirma y sus controles usan los campos nuevos.
    await act(async () => {
      ready = true;
      resume();
    });
    expect(screen.getByText("Bea")).toBeVisible();
    expect(screen.queryByText("Ada")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copiado" })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copiar Usuario" })));
    expect(copy).toHaveBeenLastCalledWith("Bea");
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("button", { name: "Copiar Usuario" })).toBeVisible();
    expect(container.innerHTML).not.toContain("secreto-sintetico");
  },
);
