import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SwapText } from "./SwapText.tsx";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("monta sin movimiento y conserva solo el texto nuevo accesible durante el cambio", () => {
  const { container, rerender } = render(<SwapText value="En cola" />);
  expect(container.querySelector(".ld-swap-new, .ld-swap-old")).toBeNull();
  rerender(<SwapText value="Listo" />);
  const old = container.querySelector(".ld-swap-old");
  expect(old).toHaveAttribute("aria-hidden", "true");
  expect(old).toHaveTextContent("En cola");
  expect(container.querySelector(".ld-swap-new")).toHaveTextContent("Listo");
  expect(container.querySelectorAll("[data-swap-new]")).toHaveLength(1);
  expect(container.querySelector("[data-swap-new]")?.closest('[aria-hidden="true"]')).toBeNull();
  fireEvent(old as Element, new Event("webkitAnimationEnd", { bubbles: true }));
  expect(container.querySelector(".ld-swap-old")).toBeNull();
  expect(container.querySelector(".ld-swap-new")).toBeNull();
});
it("retira la capa anterior con respaldo y reinicia ante cambios consecutivos", () => {
  vi.useFakeTimers();
  const { container, rerender } = render(<SwapText value="En cola" />);
  rerender(<SwapText value="Convirtiendo" />);
  rerender(<SwapText value="Error" />);
  expect(container.querySelector(".ld-swap-old")).toHaveTextContent("Convirtiendo");
  act(() => vi.runAllTimers());
  expect(container.querySelector(".ld-swap-old")).toBeNull();
});
it("ancla el texto saliente al lado indicado", () => {
  const { container, rerender } = render(<SwapText value="En cola" align="end" />);
  expect(container.querySelector(".ld-swap-text")).toHaveClass("ld-swap-end");
  rerender(<SwapText value="Listo" />);
  expect(container.querySelector(".ld-swap-text")).not.toHaveClass("ld-swap-end");
});
it("la capa saliente muestra lo último que se veía aunque children cambiara sin value", () => {
  const { container, rerender } = render(<SwapText value="a">Inicial</SwapText>);
  rerender(<SwapText value="a">Actualizado</SwapText>);
  expect(container.querySelector(".ld-swap-old")).toBeNull();
  rerender(<SwapText value="b">Nuevo</SwapText>);
  expect(container.querySelector(".ld-swap-old")).toHaveTextContent("Actualizado");
});
