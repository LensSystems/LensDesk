import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "./i18n.ts";
import { buildMenuTemplate, tabMenuEntries } from "./menu.ts";

describe("buildMenuTemplate", () => {
  it("asigna el menú Ventana y sus atajos al orden recibido", () => {
    const activate = vi.fn();
    const template = buildMenuTemplate(
      createTranslator("es"),
      "darwin",
      [
        { toolId: "two", name: "Dos" },
        { toolId: "one", name: "Uno" },
      ],
      activate,
    );
    const items = template.find((item) => item.label === "Ventana")?.submenu ?? [];
    expect(items.slice(-2).map(({ label, accelerator }) => ({ label, accelerator }))).toEqual([
      { label: "Dos", accelerator: "CmdOrCtrl+1" },
      { label: "Uno", accelerator: "CmdOrCtrl+2" },
    ]);
    items.at(-1)?.click?.();
    expect(activate).toHaveBeenCalledWith("one");
  });

  it.each(["darwin", "win32"] as const)("builds localized menus for %s", (platform) => {
    for (const locale of ["es", "en"] as const) {
      const template = buildMenuTemplate(createTranslator(locale), platform);
      const labels = template.flatMap((item) => [
        item.label,
        ...(item.submenu?.map((child) => child.label) ?? []),
      ]);
      expect(labels.every((label) => label.trim().length > 0)).toBe(true);
      expect(labels.every((label) => !label.startsWith("menu."))).toBe(true);
      const shortcuts = template
        .flatMap((item) => item.submenu ?? [])
        .map((item) => item.accelerator);
      expect(shortcuts).toEqual(
        expect.arrayContaining([
          "CmdOrCtrl+T",
          "CmdOrCtrl+W",
          "Ctrl+Tab",
          "Ctrl+Shift+Tab",
          "CmdOrCtrl+1",
          "CmdOrCtrl+9",
          "CmdOrCtrl+,",
        ]),
      );
    }
  });
});

it("nombra las pestañas del menú Ventana en el idioma activo y en su orden", () => {
  const manifests: Record<string, { manifest: Record<string, unknown> }> = {
    notes: { manifest: { name: { es: "Notas", en: "Notes" } } },
  };
  expect(
    tabMenuEntries(
      [{ toolId: "missing" }, { toolId: "notes" }],
      { get: (id) => manifests[id] },
      "en",
    ),
  ).toEqual([
    { toolId: "missing", name: "missing" },
    { toolId: "notes", name: "Notes" },
  ]);
});
