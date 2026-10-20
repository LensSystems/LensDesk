import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("hereda el foco y la reducción global de movimiento en todas las superficies", () => {
  const shared = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const theme = readFileSync(new URL("../../sdk/src/theme.css", import.meta.url), "utf8");
  expect(shared).toContain('@import "@lensdesk/sdk/theme.css"');
  expect(theme).toMatch(
    /:focus-visible\s*\{\s*outline: 2px solid var\(--ld-accent\);\s*outline-offset: 2px;/,
  );
  expect(theme).toMatch(
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{\s*animation: none !important;\s*scroll-behavior: auto !important;\s*transition: none !important;/,
  );
});

it("reserva cuatro píxeles para el foco en listas desplazables", () => {
  for (const path of [
    "../../../tools/notes/src/ui/styles.css",
    "../../../tools/md-converter/src/ui/styles.css",
  ]) {
    const css = readFileSync(new URL(path, import.meta.url), "utf8");
    expect(css).toMatch(/(?:\.note-list nav|\.queue-list)\s*\{[^}]*padding: 4px;/);
  }
});

it("muestra el foco alrededor de la zona visible del editor", () => {
  const css = readFileSync(
    new URL("../../../tools/notes/src/ui/styles.css", import.meta.url),
    "utf8",
  );
  expect(css).toMatch(
    /\.code-editor:focus-within\s*\{\s*outline: 2px solid var\(--ld-accent\);[^}]*outline-offset: -2px;/,
  );
  expect(css).not.toMatch(/\.code-editor\s*\{[^}]*margin:/);
});
