import { SHORTCUTS } from "./shell/shortcuts.ts";

export type MenuItem = {
  label: string;
  role?: string;
  accelerator?: string;
  submenu?: MenuItem[];
};

export type MenuTranslator = (key: string) => string;

export function buildMenuTemplate(t: MenuTranslator, platform: NodeJS.Platform): MenuItem[] {
  const menu = (key: string): string => t(`menu.${key}`);
  const template: MenuItem[] = [
    {
      label: platform === "darwin" ? menu("app") : menu("file"),
      submenu:
        platform === "darwin"
          ? [
              { label: menu("about"), role: "about" },
              { label: menu("quit"), role: "quit" },
            ]
          : [{ label: menu("quit"), role: "quit" }],
    },
    {
      label: menu("edit"),
      submenu: ["undo", "redo", "cut", "copy", "paste", "selectAll"].map((key) => ({
        label: menu(key),
        role: key,
      })),
    },
    {
      label: menu("tools"),
      submenu: [
        { label: menu("showTools"), accelerator: SHORTCUTS.tools },
        { label: menu("closeTab"), accelerator: SHORTCUTS.closeTab },
        { label: menu("nextTab"), accelerator: SHORTCUTS.nextTab },
        { label: menu("previousTab"), accelerator: SHORTCUTS.previousTab },
        ...Array.from({ length: 9 }, (_, index) => ({
          label: menu("switchToTab").replace("{{number}}", String(index + 1)),
          accelerator: SHORTCUTS.tab(index + 1),
        })),
        { label: menu("settings"), accelerator: SHORTCUTS.settings },
      ],
    },
    {
      label: menu("view"),
      submenu: ["reload", "toggleDevTools"].map((key) => ({
        label: menu(key),
        role: key === "reload" ? "reload" : "toggleDevTools",
      })),
    },
    {
      label: menu("window"),
      submenu: ["minimize", "close"].map((key) => ({
        label: menu(key),
        role: key === "minimize" ? "minimize" : "close",
      })),
    },
  ];
  if (platform !== "darwin") template.push({ label: menu("help"), submenu: [] });
  return template;
}
