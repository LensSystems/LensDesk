import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueueFilename } from "./QueueFilename.tsx";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(reduced = false, overflow = true) {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(overflow ? 300 : 80);
  const { container } = render(<QueueFilename name="documento-largo.html" />);
  expect(screen.getByText("documento-largo.html")).toBeTruthy();
  const name = container.querySelector<HTMLElement>(".queue-filename");
  if (!name) throw new Error("Falta el nombre del archivo");
  return name;
}

it("espera 0,5 s de puntero encima y vuelve a recortar al salir", () => {
  const name = setup();
  act(() => vi.advanceTimersByTime(1000));
  expect(name).toHaveAttribute("data-moving", "false");
  fireEvent.mouseEnter(name);
  act(() => vi.advanceTimersByTime(499));
  expect(name).toHaveAttribute("data-moving", "false");
  act(() => vi.advanceTimersByTime(1));
  expect(name).toHaveAttribute("data-moving", "true");
  fireEvent.mouseLeave(name);
  expect(name).toHaveAttribute("data-moving", "false");
});

it("permanece quieto con reducir movimiento", () => {
  const name = setup(true);
  fireEvent.mouseEnter(name);
  act(() => vi.advanceTimersByTime(2000));
  expect(name).toHaveAttribute("data-moving", "false");
});

it("no desplaza un nombre que cabe ni inicia un hover interrumpido", () => {
  const name = setup(false, false);
  fireEvent.mouseEnter(name);
  act(() => vi.advanceTimersByTime(2000));
  expect(name).toHaveAttribute("data-moving", "false");
});

it("cancela la espera al salir antes de medio segundo", () => {
  const name = setup();
  fireEvent.mouseEnter(name);
  act(() => vi.advanceTimersByTime(300));
  fireEvent.mouseLeave(name);
  act(() => vi.advanceTimersByTime(2000));
  expect(name).toHaveAttribute("data-moving", "false");
});
