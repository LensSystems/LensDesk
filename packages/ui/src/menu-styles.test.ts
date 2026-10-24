import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { menuItemClass } from "./menu-styles.ts";

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
