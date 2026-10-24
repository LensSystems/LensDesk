import { TooltipProvider } from "@lensdesk/ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { EditorToolbar } from "./EditorToolbar.tsx";

it.each([
  ["MacIntel", "es", "⌘⇧X"],
  ["Win32", "es", "Ctrl+Mayús+X"],
  ["Win32", "en", "Ctrl+Shift+X"],
])("separa etiquetas y atajos en %s/%s", async (platform, lng, strike) => {
  vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
  await i18n
    .use(initReactI18next)
    .init({ lng, resources: { es: { translation: es }, en: { translation: en } } });
  render(
    <TooltipProvider>
      <EditorToolbar canUndo canRedo onUndo={vi.fn()} onRedo={vi.fn()} onFormat={vi.fn()} />
    </TooltipProvider>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: i18n.t("format") }), { key: "ArrowDown" });
  const menu = screen.getByRole("menu");
  expect(menu).toHaveClass("w-[244px]");
  const items = within(menu).getAllByRole("menuitem");
  expect(items).toHaveLength(6);
  for (const [index, format] of [
    "bold",
    "italic",
    "underline",
    "strike",
    "code",
    "link",
  ].entries()) {
    const item = items[index];
    if (!item) throw new Error(`Missing menu item: ${format}`);
    expect(within(item).getByText(i18n.t(`formatting.${format}`))).not.toHaveTextContent(/\(/);
    expect(items[index]?.querySelector("kbd")).toHaveClass("ml-auto", "text-muted");
  }
  expect(items[3]?.querySelector("kbd")).toHaveTextContent(strike);
  expect(within(menu).getByRole("separator")).toHaveClass("mx-1.5");
  vi.restoreAllMocks();
});
