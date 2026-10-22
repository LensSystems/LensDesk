import { join } from "node:path";
import { shell, WebContentsView } from "electron";
import { HEADER_HEIGHT } from "../../shared/layout.ts";
import { spellcheckEnabled } from "../spellcheck.ts";
import { registerToolProtocolFor } from "./protocol.ts";

export function toolWebPreferences(
  toolId: string,
  platform: string = process.platform,
): Electron.WebPreferences {
  return {
    spellcheck: spellcheckEnabled(platform),
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
  return {
    x: 0,
    y: HEADER_HEIGHT,
    width: bounds.width,
    height: Math.max(0, bounds.height - HEADER_HEIGHT),
  };
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
  platform?: string;
  external?: (url: string) => Promise<void>;
}) {
  const views = new Map<string, ToolView>();
  const visible = new Set<ToolView>();
  const visibility = (view: ToolView, next: boolean) => {
    if (visible.has(view) === next) return;
    if (next) visible.add(view);
    else visible.delete(view);
    view.webContents.send?.("lensdesk:tool-event:app.visibilityChanged", next);
  };
  const contentsToTool = new Map<number, string>();
  const factory =
    options.factory ??
    ((toolId) =>
      new WebContentsView({
        webPreferences: toolWebPreferences(toolId, options.platform),
      }) as unknown as ToolView);
  const remove = (toolId: string): void => {
    const view = views.get(toolId);
    if (!view) return;
    visibility(view, false);
    options.host.removeChildView(view);
    contentsToTool.delete(view.webContents.id);
    view.webContents.close();
    views.delete(toolId);
  };
  return {
    getToolIdForContents: (id: number) => contentsToTool.get(id),
    getViews: () => [...views.values()],
    hideAll(): void {
      for (const view of visible) {
        visibility(view, false);
        options.host.removeChildView(view);
      }
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
        if (spellcheckEnabled(options.platform ?? process.platform)) {
          const target = view;
          target.webContents.on("context-menu", ((
            _event: unknown,
            params: {
              misspelledWord?: string;
              dictionarySuggestions?: string[];
            },
          ) => {
            target.webContents.send?.("lensdesk:tool-event:app.spelling", {
              word: (params.misspelledWord ?? "").slice(0, 100).replace(/[\r\n\u2028\u2029]/g, ""),
              suggestions: (params.dictionarySuggestions ?? [])
                .filter((word) => word.length > 0)
                .slice(0, 8)
                .map((word) => word.slice(0, 100)),
            });
          }) as never);
        }
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
      for (const other of visible) {
        if (other === view) continue;
        visibility(other, false);
        options.host.removeChildView(other);
      }
      options.host.addChildView(view);
      visibility(view, true);
      view.setBounds(computeViewBounds(bounds));
    },
    destroyAll(): void {
      for (const toolId of [...views.keys()]) remove(toolId);
    },
  };
}
