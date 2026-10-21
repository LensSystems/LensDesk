type Tabs = { toolId: string; position: number; active: boolean }[];

// Handlers del router para pestañas y páginas del shell. La vista de la herramienta activa solo
// se muestra cuando hay una pestaña activa; `follow` recalcula eso tras cada cambio.
export function createTabHandlers(options: {
  tabsStore(): {
    list(): Tabs;
    open(toolId: string): Tabs;
    undoClose(toolId: string): Tabs;
    close(toolId: string): Tabs;
    activate(toolId: string): Tabs;
    move(toolId: string, toIndex: number): Tabs;
  };
  follow(tabs: Tabs): void;
  notifyClosed(toolId: string): void;
  closeTool(toolId: string): void;
  hideAll(): void;
  leaveTab(): void;
}) {
  const apply = (compute: (store: ReturnType<typeof options.tabsStore>) => Tabs, notify = true) => {
    const store = options.tabsStore();
    const before = store.list();
    const tabs = compute(store);
    for (const tab of before) {
      if (!tabs.some((current) => current.toolId === tab.toolId)) {
        options.closeTool(tab.toolId);
        if (notify) options.notifyClosed(tab.toolId);
      }
    }
    options.follow(tabs);
    return { tabs };
  };
  return {
    // Mover no abre ni cierra nada: no cambia la vista visible.
    "tabs.move": ({ toolId, toIndex }: { toolId: string; toIndex: number }) => ({
      tabs: options.tabsStore().move(toolId, toIndex),
    }),
    "tabs.list": () => ({ tabs: options.tabsStore().list() }),
    "tabs.open": ({ toolId }: { toolId: string }) => apply((store) => store.open(toolId)),
    "tabs.undoClose": ({ toolId }: { toolId: string }) => apply((store) => store.undoClose(toolId)),
    "tabs.close": ({ toolId }: { toolId: string }) => apply((store) => store.close(toolId), false),
    "tabs.activate": ({ toolId }: { toolId: string }) => apply((store) => store.activate(toolId)),
    "shell.showPage": ({ page }: { page: "tools" | "settings" }) => {
      options.leaveTab();
      options.hideAll();
      return { page };
    },
  };
}
