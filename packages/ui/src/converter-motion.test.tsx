import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { FileDropZone } from "./FileDropZone.tsx";

afterEach(cleanup);
it("marca el arrastre en la zona animable y lo retira al salir", () => {
  const { container } = render(<FileDropZone label="Archivos" buttonLabel="Elegir" />);
  const zone = container.querySelector(".ld-file-drop") as HTMLElement;
  expect(zone).not.toBeNull();
  fireEvent.dragEnter(zone);
  expect(zone).toHaveAttribute("data-dragging", "true");
  fireEvent.dragLeave(zone);
  expect(zone).toHaveAttribute("data-dragging", "false");
});
it("limita escala, colores y duración rápida al movimiento permitido", () => {
  const tokens = readFileSync("packages/sdk/src/theme.css", "utf8");
  expect(tokens).toContain("--ld-motion: 150ms");
  expect(tokens).toContain("--ld-motion-fast: 140ms");
  const css = readFileSync("packages/ui/src/styles.css", "utf8");
  const start = css.indexOf("  .ld-file-drop {");
  expect(start).toBeGreaterThan(0);
  const media = css.lastIndexOf("@media (prefers-reduced-motion: no-preference)", start);
  expect(css.slice(media, start)).not.toContain("\n}\n");
  expect(css.slice(start, start + 500)).toContain("scale(1.01)");
  expect(css.slice(start, start + 500)).toContain("transform var(--ld-motion) var(--ld-ease-out)");
  expect(css.slice(media, start)).toContain("animation-duration: var(--ld-motion-fast)");
});
