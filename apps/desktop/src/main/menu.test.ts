import { describe, expect, it } from "vitest";
import { createTranslator } from "./i18n.ts";
import { buildMenuTemplate } from "./menu.ts";

describe("buildMenuTemplate", () => {
  it.each(["darwin", "win32"] as const)("builds localized menus for %s", (platform) => {
    for (const locale of ["es", "en"] as const) {
      const template = buildMenuTemplate(createTranslator(locale), platform);
      const labels = template.flatMap((item) => [
        item.label,
        ...(item.submenu?.map((child) => child.label) ?? []),
      ]);
      expect(labels.every((label) => label.trim().length > 0)).toBe(true);
      expect(labels.every((label) => !label.startsWith("menu."))).toBe(true);
    }
  });
});
