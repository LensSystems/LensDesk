import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("limita el movimiento del fondo a la preferencia permitida y usa los tokens", () => {
  const css = readFileSync("apps/desktop/src/renderer/src/styles.css", "utf8");
  expect(css).toMatch(
    /@media \(prefers-reduced-motion: no-preference\)\s*{\s*\.ld-active-tab-indicator\[data-motion="on"\]\s*{\s*transition:\s*transform var\(--ld-motion\) var\(--ld-ease-out\),\s*width var\(--ld-motion\) var\(--ld-ease-out\);/,
  );
});
