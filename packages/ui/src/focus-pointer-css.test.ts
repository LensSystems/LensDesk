import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8").replace(/\s+/g, " ");

it("tras un clic quita el contorno salvo en los campos de texto", () => {
  const css = read("../../sdk/src/theme.css");
  const rule = css.match(
    /:root\[data-modalidad="puntero"\] :focus-visible:not\([^{]+\{[^}]+\}/,
  )?.[0];
  expect(rule).toBeDefined();
  for (const field of [
    "input:not(",
    '[type="checkbox"]',
    "textarea",
    "select",
    "[contenteditable]",
  ])
    expect(rule).toContain(field);
  expect(rule).toContain("outline: none;");
  expect(rule).not.toContain("!important");
  // El contorno general de teclado sigue igual.
  expect(css).toContain(
    ":focus-visible { outline: 2px solid var(--ld-accent); outline-offset: 2px; }",
  );
});

it("las reglas de foco más específicas también respetan el clic", () => {
  expect(read("./styles.css")).toContain(
    ':root:not([data-modalidad="puntero"]) .ld-markdown-view .ld-code-block button[data-copy-code]:focus-visible {',
  );
  const shell = read("../../../apps/desktop/src/renderer/src/styles.css");
  expect(
    shell.match(/:hover, :focus-visible:not\(\[data-modalidad="puntero"\] \*\)/g),
  ).toHaveLength(2);
  const tab = read("../../../apps/desktop/src/renderer/src/shell/TabItem.tsx");
  expect(tab).not.toMatch(/group-has-\[:focus-visible\]/);
  expect(
    tab.match(/group-has-\[:focus-visible:not\(\[data-modalidad=puntero\]_\*\)\]/g),
  ).toHaveLength(2);
});

it("cada interfaz activa el seguimiento al arrancar", () => {
  for (const path of [
    "../../../apps/desktop/src/renderer/src/main.tsx",
    "../../../tools/notes/src/ui/main.tsx",
    "../../../tools/md-converter/src/ui/main.tsx",
    "../../../tools/_template/src/ui/main.tsx",
  ])
    expect(read(path)).toContain("trackInputModality();");
});
