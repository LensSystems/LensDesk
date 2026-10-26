import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync(new URL("./tailwind.css", import.meta.url), "utf8");

function selectorsFor(declaration: string) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[2]?.includes(declaration))
    .map((match) => match[1])
    .join("\n");
}

it("da cursor de mano a los controles y prioridad a los deshabilitados", () => {
  expect(css).toContain("@layer base");
  const pointer = selectorsFor("cursor: pointer;");
  expect(pointer).toContain(":where(");
  for (const selector of [
    "button:not(:disabled)",
    "a[href]",
    "label[for]",
    "summary",
    "select",
    ...["tab", "menuitem", "menuitemradio", "option", "radio", "switch", "checkbox"].map(
      (role) => `[role="${role}"]`,
    ),
  ])
    expect(pointer).toContain(selector);
  const disabled = selectorsFor("cursor: not-allowed;");
  for (const selector of [":disabled", '[aria-disabled="true"]', "[data-disabled]"])
    expect(disabled).toContain(selector);
  for (const file of ["Select.tsx", "DropdownMenu.tsx"])
    expect(readFileSync(new URL(`../../ui/src/${file}`, import.meta.url), "utf8")).not.toContain(
      "cursor-default",
    );
});

it("permite seleccionar solo campos, editores y contenido copiable", () => {
  expect(selectorsFor("user-select: none;").trim()).toBe("body");
  const selectable = selectorsFor("user-select: text;");
  for (const selector of [
    "input",
    "textarea",
    "[contenteditable]",
    ".cm-content",
    ".ld-markdown-view",
    ".ld-selectable",
  ])
    expect(selectable).toContain(selector);
  const converter = readFileSync(
    new URL("../../../tools/md-converter/src/ui/styles.css", import.meta.url),
    "utf8",
  );
  expect(converter).toMatch(/\.raw-markdown\s*\{[^}]*user-select: text;/);
});
