import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { contextMenuContentClass, dropdownMenuContentClass, menuItemClass } from "./menu-styles.ts";

const menuStyles = { contextMenuContentClass, dropdownMenuContentClass };

it("mantiene filas de 32 px sin opacidad y separadores con margen lateral", () => {
  expect(menuItemClass.split(" ")).toEqual(
    expect.arrayContaining(["h-8", "px-2.5", "gap-2.5", "data-[disabled]:text-border-control"]),
  );
  expect(menuItemClass).not.toMatch(/opacity|py-/);
  for (const file of ["ContextMenu.tsx", "ContextMenuItems.tsx", "DropdownMenu.tsx"]) {
    expect(readFileSync(new URL(file, import.meta.url), "utf8")).toContain(
      "my-1 mx-1.5 h-px bg-border",
    );
  }
});

it.each([
  ["DropdownMenu.tsx", "dropdownMenuContentClass", "dropdown"],
  ["ContextMenu.tsx", "contextMenuContentClass", "context"],
  ["ContextMenuItems.tsx", "contextMenuContentClass", "context"],
] as const)("%s aplica el origen de Radix al contenido", (file, className, type) => {
  expect(menuStyles[className].split(" ")).toEqual(
    expect.arrayContaining([
      "ld-pop",
      `origin-[var(--radix-${type}-menu-content-transform-origin)]`,
    ]),
  );
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  expect(source).toContain(`cn(${className},`);
});
