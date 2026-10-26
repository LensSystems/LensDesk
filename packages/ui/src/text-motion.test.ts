import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("limita las capas de texto al movimiento permitido y usa los tokens compartidos", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  expect(css).toMatch(
    /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.ld-swap-old\s*\{[^}]*animation: ld-text-out var\(--ld-motion\) var\(--ld-ease-out\) both;\s*\}\s*\.ld-swap-new\s*\{\s*animation: ld-text-in var\(--ld-motion\) var\(--ld-ease-out\) both;/,
  );
  expect(css).toMatch(/\.ld-swap-old\s*\{[^}]*position: absolute;[^}]*visibility: hidden;/);
  expect(css).toMatch(/\.ld-swap-end > \.ld-swap-old\s*\{\s*inset: 0 0 auto auto;/);
});
it("funde el subrayado y mueve solo la flecha con movimiento permitido", () => {
  const css = readFileSync(
    new URL("../../../apps/desktop/src/renderer/src/styles.css", import.meta.url),
    "utf8",
  );
  expect(css).toMatch(/\.ld-update-link\s*\{\s*text-decoration-color: transparent;/);
  expect(css).toMatch(
    /\.ld-update-link:is\(:hover, :focus-visible\)\s*\{\s*text-decoration-color: currentColor;/,
  );
  expect(css).toMatch(
    /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.ld-update-link\s*\{\s*transition: text-decoration-color var\(--ld-motion-fast\) var\(--ld-ease-out\);\s*\}\s*\.ld-update-arrow\s*\{\s*transition: transform var\(--ld-motion-fast\) var\(--ld-ease-out\);\s*\}\s*\.ld-update-link:is\(:hover, :focus-visible\) \.ld-update-arrow\s*\{\s*transform: translate\(2px, -2px\);/,
  );
});
