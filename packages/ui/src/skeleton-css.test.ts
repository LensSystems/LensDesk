import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("limita el latido y la entrada a movimiento permitido y respeta los tiempos", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const section = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: no-preference)"));
  expect(section).toContain("ld-carga-latido 1.2s ease-in-out infinite");
  expect(section).toContain("ld-carga-aparicion var(--ld-motion-slow) var(--ld-ease-out)");
  expect(section).toContain("@keyframes ld-carga-latido");
  expect(section).toContain("@keyframes ld-carga-aparicion");
  expect(
    css.slice(0, css.lastIndexOf("@media (prefers-reduced-motion: no-preference)")),
  ).not.toMatch(/animation: ld-carga/);
  const theme = readFileSync(new URL("../../sdk/src/theme.css", import.meta.url), "utf8");
  expect(theme).toMatch(/--ld-motion-slow:\s*160ms/);
});
