import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("desliza la píldora solo tras un clic y mantiene el color del texto con transición, con tokens", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  expect(css).toMatch(
    /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.ld-selector\[data-motion="on"\] > \.ld-indicator\s*\{\s*transition:\s*transform var\(--ld-motion\) var\(--ld-ease-out\),\s*width var\(--ld-motion\) var\(--ld-ease-out\);\s*\}\s*\.ld-option\s*\{\s*transition: color var\(--ld-motion\) var\(--ld-ease-out\);/,
  );
});
