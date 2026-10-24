import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton.tsx";
import { Tooltip, TooltipProvider } from "./Tooltip.tsx";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("omite la etiqueta de cierre conservando el nombre y el clic", () => {
  vi.useFakeTimers();
  const onClick = vi.fn();
  render(
    <IconButton label="Cerrar" tooltip={false} onClick={onClick}>
      ×
    </IconButton>,
  );
  const button = screen.getByRole("button", { name: "Cerrar" });
  fireEvent.pointerMove(button, { pointerType: "mouse" });
  act(() => {
    button.focus();
    vi.advanceTimersByTime(300);
  });
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(button).not.toHaveAttribute("title");
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
});
it.each(["display", "clip"])("sigue la visibilidad CSS del texto al redimensionar: %s", (mode) => {
  vi.useFakeTimers();
  // Radix también crea observadores: se avisa a todos con una lista de entradas vacía.
  const callbacks: ((entries: unknown[]) => void)[] = [];
  const resize = () => {
    for (const callback of callbacks) callback([]);
  };
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: (entries: unknown[]) => void) {
        callbacks.push(callback);
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const { unmount } = render(
    <TooltipProvider>
      <Tooltip label="Guardar" visibleTextSelector=".label">
        <button type="button">
          <span aria-hidden="true">↓</span>
          <span className="label">Guardar</span>
        </button>
      </Tooltip>
    </TooltipProvider>,
  );
  const button = screen.getByRole("button", { name: "Guardar" });
  fireEvent.pointerMove(button, { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByRole("tooltip")).toBeNull();
  const label = button.querySelector<HTMLElement>(".label");
  if (!label) throw new Error("Falta texto");
  label.style.cssText =
    mode === "display" ? "display:none" : "position:absolute;clip:rect(0px, 0px, 0px, 0px)";
  act(() => resize());
  fireEvent.pointerLeave(button, { pointerType: "mouse" });
  fireEvent.pointerMove(button, { pointerType: "mouse" });
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByRole("tooltip")).toHaveTextContent("Guardar");
  label.style.cssText = "";
  act(() => resize());
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByRole("tooltip")).toBeNull();
  unmount();
  expect(disconnect).toHaveBeenCalled();
});
