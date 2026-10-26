import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const motion = css.slice(css.indexOf("/* Movimiento de los controles. */"));

it("desliza el círculo y cambia sus colores con los tokens de movimiento", () => {
  expect(css).toMatch(/\.ld-switch:checked::before\s*\{\s*transform: translateX\(16px\);/);
  expect(css).not.toContain("left: 17px");
  expect(motion).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
  expect(motion).toContain("transform var(--ld-motion) var(--ld-ease-out)");
  expect(motion).toContain("background-color var(--ld-motion) var(--ld-ease-out)");
  expect(motion).toContain("border-color var(--ld-motion) var(--ld-ease-out)");
});

it("rellena y dibuja solo al marcar; al desmarcar funde durante 120 ms", () => {
  expect(css).toMatch(/\.ld-checkbox::after\s*\{[^}]*opacity: 0;/);
  expect(motion).toContain("background-color 120ms var(--ld-ease-out)");
  expect(motion).toContain("border-color 120ms var(--ld-ease-out)");
  expect(motion).toContain("opacity 120ms var(--ld-ease-out)");
  expect(motion).toMatch(
    /\.ld-checkbox:checked::before\s*\{[^}]*background-color var\(--ld-motion-slow\) var\(--ld-ease-out\),\s*border-color var\(--ld-motion-slow\) var\(--ld-ease-out\)/,
  );
  expect(motion).toMatch(
    /\.ld-checkbox\[data-motion="on"\]:checked::after\s*\{\s*animation: ld-palomita var\(--ld-motion-slow\) var\(--ld-ease-out\);/,
  );
  expect(motion).toContain("clip-path: inset(80% 100% 0 0)");
  expect(motion).toContain("clip-path: inset(0)");
});
