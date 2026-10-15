import { join } from "node:path";
import { shell, WebContentsView } from "electron";
import { registerToolProtocolFor } from "./protocol.ts";

export function toolWebPreferences(toolId: string): Electron.WebPreferences {
  return {
    partition: `persist:tool-${toolId}`,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    preload: join(import.meta.dirname, "../preload/tool.cjs"),
  };
}

export function computeViewBounds(bounds: {
  x?: number;
  y?: number;
  width: number;
  height: number;
}) {
  return { x: 0, y: 36, width: bounds.width, height: Math.max(0, bounds.height - 36) };
}

export function decideNavigation(url: string): "deny" | "external" {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:" ? "external" : "deny";
  } catch {
    return "deny";
  }
}

export type ToolView = {
  setBounds(bounds: ReturnType<typeof computeViewBounds>): void;
  webContents: {
    id: number;
    send?(channel: string, payload: unknown): void;
    close(): void;
    on(event: string, listener: (...args: never[]) => void): void;
    setWindowOpenHandler(handler: (details: { url: string }) => { action: "deny" }): void;
    loadURL(url: string): Promise<void>;
  };
};
export type ViewFactory = (toolId: string) => ToolView;
export type ViewHost = {
  addChildView(view: ToolView): void;
  removeChildView(view: ToolView): void;
};

export function createToolViews(options: {
  host: ViewHost;
  registry: { get(id: string): { enabled: boolean } | undefined };
  factory?: ViewFactory;
  external?: (url: string) => Promise<void>;
}) {
  const views = new Map<string, ToolView>();
  const contentsToTool = new Map<number, string>();
  const factory =
    options.factory ??
    ((toolId) =>
      new WebContentsView({ webPreferences: toolWebPreferences(toolId) }) as unknown as ToolView);
  const remove = (toolId: string): void => {
    const view = views.get(toolId);
    if (!view) return;
    options.host.removeChildView(view);
    contentsToTool.delete(view.webContents.id);
    view.webContents.close();
    views.delete(toolId);
  };
  return {
    getToolIdForContents: (id: number) => contentsToTool.get(id),
    getViews: () => [...views.values()],
    hideAll(): void {
      for (const view of views.values()) options.host.removeChildView(view);
    },
    close(toolId: string): void {
      remove(toolId);
    },
    closeDisabled(): void {
      for (const toolId of views.keys()) if (!options.registry.get(toolId)?.enabled) remove(toolId);
    },
    show(toolId: string, bounds: { x?: number; y?: number; width: number; height: number }): void {
      const tool = options.registry.get(toolId);
      if (!tool?.enabled) return;
      registerToolProtocolFor(
        toolId,
        options.registry as {
          get(id: string): { id: string; installPath: string; enabled: boolean } | undefined;
        },
      );
      let view = views.get(toolId);
      if (!view) {
        view = factory(toolId);
        views.set(toolId, view);
        contentsToTool.set(view.webContents.id, toolId);
        view.webContents.on("will-navigate", ((
          event: { preventDefault(): void },
          target: string,
        ) => {
          event.preventDefault();
          if (decideNavigation(target) === "external")
            void (options.external ?? shell.openExternal)(target);
        }) as never);
        view.webContents.setWindowOpenHandler(({ url }) => {
          if (decideNavigation(url) === "external")
            void (options.external ?? shell.openExternal)(url);
          return { action: "deny" };
        });
        void view.webContents.loadURL(`lenstool://${toolId}/`);
      }
      options.host.addChildView(view);
      view.setBounds(computeViewBounds(bounds));
    },
    destroyAll(): void {
      for (const toolId of [...views.keys()]) remove(toolId);
    },
  };
}
