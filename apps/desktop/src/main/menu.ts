import { SHORTCUTS } from "./shell/shortcuts.ts";

export type MenuItem = {
  label: string;
  role?: string;
  accelerator?: string;
  submenu?: MenuItem[];
  click?: () => void;
};

export type MenuTranslator = (key: string) => string;

// Nombre de cada pestaña abierta para el menú «Ventana», en el orden de la barra.
export function tabMenuEntries(
  tabs: { toolId: string }[],
  registry: { get(id: string): { manifest: Record<string, unknown> } | undefined },
  locale: string,
): { toolId: string; name: string }[] {
  return tabs.map(({ toolId }) => {
    const name = registry.get(toolId)?.manifest.name as Record<string, string> | undefined;
    return { toolId, name: name?.[locale] ?? toolId };
  });
}

export function buildMenuTemplate(
  t: MenuTranslator,
  platform: NodeJS.Platform,
  tabs: { toolId: string; name: string }[] = [],
  activate: (toolId: string) => void = () => undefined,
): MenuItem[] {
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
        ...Array.from({ length: tabs.length ? 0 : 9 }, (_, index) => ({
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
      submenu: [
        ...["minimize", "close"].map((key) => ({
          label: menu(key),
          role: key === "minimize" ? "minimize" : "close",
        })),
        ...tabs.map((tab, index) => ({
          label: tab.name,
          accelerator: index < 9 ? SHORTCUTS.tab(index + 1) : undefined,
          click: () => activate(tab.toolId),
        })),
      ],
    },
  ];
  if (platform !== "darwin") template.push({ label: menu("help"), submenu: [] });
  return template;
}
