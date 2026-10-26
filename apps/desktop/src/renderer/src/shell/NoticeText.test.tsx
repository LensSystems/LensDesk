import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NoticeText } from "./NoticeText.tsx";

afterEach(() => vi.restoreAllMocks());

it("no redibuja sin fin cuando el ancho medido varía en decimales", () => {
  let read = 0;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ width: read++ % 2 ? 212.2969 : 212.29684 }) as DOMRect,
  );
  render(<NoticeText>Se cerró Plantilla 1 para abrir Plantilla 6</NoticeText>);
  const text = screen
    .getByText("Se cerró Plantilla 1 para abrir Plantilla 6")
    .closest("[data-notice-text]") as HTMLElement;
  expect(text.style.getPropertyValue("--notice-distance")).toBe("-237px");
});
