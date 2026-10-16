type Tabs = { toolId: string; position: number; active: boolean }[];

// Handlers del router para pestañas y páginas del shell. La vista de la herramienta activa solo
// se muestra cuando hay una pestaña activa; `follow` recalcula eso tras cada cambio.
export function createTabHandlers(options: {
  tabsStore(): {
    list(): Tabs;
    open(toolId: string): Tabs;
    close(toolId: string): Tabs;
    activate(toolId: string): Tabs;
  };
  follow(tabs: Tabs): void;
  closeTool(toolId: string): void;
  hideAll(): void;
  leaveTab(): void;
}) {
  const apply = (compute: (store: ReturnType<typeof options.tabsStore>) => Tabs) => {
    const tabs = compute(options.tabsStore());
    options.follow(tabs);
    return { tabs };
  };
  return {
    "tabs.list": () => ({ tabs: options.tabsStore().list() }),
    "tabs.open": ({ toolId }: { toolId: string }) => apply((store) => store.open(toolId)),
    "tabs.close": ({ toolId }: { toolId: string }) =>
      apply((store) => {
        const tabs = store.close(toolId);
        options.closeTool(toolId);
        return tabs;
      }),
    "tabs.activate": ({ toolId }: { toolId: string }) => apply((store) => store.activate(toolId)),
    "shell.showPage": ({ page }: { page: "tools" | "settings" }) => {
      options.leaveTab();
      options.hideAll();
      return { page };
    },
  };
}
