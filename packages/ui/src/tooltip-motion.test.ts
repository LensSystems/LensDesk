import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const component = readFileSync(new URL("./Tooltip.tsx", import.meta.url), "utf8");

it("las etiquetas no animan el cierre", () => {
  expect(css).not.toMatch(/\.ld-tooltip\[data-state="closed"\][^{]*\{[^}]*animation:/);
  expect(component).not.toContain("ld-tooltip ld-pop");
});
it("la entrada con escala queda limitada a la apertura con espera", () => {
  expect(component).not.toContain("ld-tooltip ld-pop");
  expect(css).toMatch(/\.ld-tooltip\[data-state="delayed-open"\]\s*\{\s*animation: ld-pop-in/);
  expect(css).not.toMatch(/\.ld-tooltip\[data-state="instant-open"\][^{]*\{[^}]*ld-pop-in/);
});
it("el viaje transforma la posición con los tokens solo si se permite movimiento", () => {
  expect(css).toMatch(
    /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.ld-tooltip[\s\S]*?transition: transform var\(--ld-motion-fast\) var\(--ld-ease-out\)/,
  );
});
