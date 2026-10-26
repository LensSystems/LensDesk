import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { HEADER_HEIGHT } from "../../shared/layout.ts";

vi.mock("electron", () => ({
  WebContentsView: class {},
  shell: { openExternal: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn() },
  session: {
    fromPartition: vi.fn(() => ({
      setSpellCheckerEnabled: vi.fn(),
      setSpellCheckerLanguages: vi.fn(),
      protocol: { handle: vi.fn() },
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      webRequest: { onBeforeRequest: vi.fn() },
    })),
  },
}));

import {
  computeViewBounds,
  createToolViews,
  decideNavigation,
  type ToolView,
  toolWebPreferences,
} from "./tool-views.ts";

function fakeView(id: number) {
  const handlers = new Map<string, (...args: never[]) => void>();
  const view = {
    bounds: undefined as unknown,
    setBounds(bounds: unknown) {
      this.bounds = bounds;
    },
    webContents: {
      id,
      close: vi.fn(),
      send: vi.fn(),
      on: vi.fn((event: string, listener: (...args: never[]) => void) =>
        handlers.set(event, listener),
      ),
      setWindowOpenHandler: vi.fn(),
      loadURL: vi.fn(async () => undefined),
    },
  };
  return { view: view as unknown as ToolView, handlers };
}

describe("tool view helpers", () => {
  it("sets isolated preferences and bounds below the tab bar", () => {
    expect(toolWebPreferences("my-tool")).toEqual({
      spellcheck: process.platform === "darwin",
      partition: "persist:tool-my-tool",
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, "../preload/tool.cjs"),
    });
    expect(HEADER_HEIGHT).toBe(52);
    expect(computeViewBounds({ width: 800, height: 600 }).y).toBe(HEADER_HEIGHT);
    expect(computeViewBounds({ width: 800, height: 600 })).toEqual({
      x: 0,
      y: 52,
      width: 800,
      height: 548,
    });
  });
  it("denies internal navigation and only allows http(s) external links", () => {
    expect(decideNavigation("lenstool://my-tool/")).toBe("deny");
    expect(decideNavigation("javascript:alert(1)")).toBe("deny");
    expect(decideNavigation("https://example.com")).toBe("external");
  });
  it("creates, hides, shows and destroys views with an injected factory", () => {
    const host = { addChildView: vi.fn(), removeChildView: vi.fn() };
    const close = vi.fn();
    const first = fakeView(1);
    const second = fakeView(2);
    const views = [first, second];
    const manager = createToolViews({
      host,
      registry: { get: () => ({ enabled: true }) },
      factory: vi.fn(() => {
        const next = views.shift();
        if (!next) throw new Error("No fake view available");
        return next.view;
      }),
      external: vi.fn(async () => undefined),
    });
    manager.show("one", { width: 800, height: 600 });
    manager.show("two", { width: 900, height: 700 });
    expect(host.addChildView).toHaveBeenCalledTimes(2);
    manager.show("two", { width: 900, height: 700 });
    expect(second.view.webContents.send).toHaveBeenCalledTimes(1);
    expect(first.view.webContents.send).toHaveBeenLastCalledWith(
      "lensdesk:tool-event:app.visibilityChanged",
      false,
    );
    manager.hideAll();
    manager.hideAll();
    expect(second.view.webContents.send).toHaveBeenCalledTimes(2);
    expect(second.view.webContents.send).toHaveBeenLastCalledWith(
      "lensdesk:tool-event:app.visibilityChanged",
      false,
    );
    expect(host.removeChildView).toHaveBeenCalledTimes(2);
    manager.show("two", { width: 900, height: 700 });
    expect(second.view.webContents.send).toHaveBeenCalledTimes(3);
    expect(second.view.webContents.send).toHaveBeenLastCalledWith(
      "lensdesk:tool-event:app.visibilityChanged",
      true,
    );
    manager.close("one");
    expect(first.view.webContents.close).toHaveBeenCalledOnce();
    expect(manager.getToolIdForContents(1)).toBeUndefined();
    manager.close("two");
    expect(second.view.webContents.close).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });
});

it.each(["darwin", "win32"])("limita el reenvío ortográfico en %s", (platform) => {
  const first = fakeView(101);
  const second = fakeView(102);
  const manager = createToolViews({
    platform,
    host: { addChildView: vi.fn(), removeChildView: vi.fn() },
    registry: { get: () => ({ enabled: true }) },
    factory: (id) => (id === "spell-one" ? first.view : second.view),
  });
  manager.show("spell-one", { width: 800, height: 600 });
  manager.show("spell-two", { width: 800, height: 600 });
  const listener = first.handlers.get("context-menu");
  if (platform === "win32") {
    expect(listener).toBeUndefined();
    return;
  }
  (listener as (...args: unknown[]) => void)(
    {},
    {
      misspelledWord: "holaa",
      dictionarySuggestions: Array(10).fill("hola"),
      selectionText: "secreto",
      linkURL: "privado",
      srcURL: "privado",
    },
  );
  expect(first.view.webContents.send).toHaveBeenCalledWith("lensdesk:tool-event:app.spelling", {
    word: "holaa",
    suggestions: Array(8).fill("hola"),
  });
  expect(second.view.webContents.send).not.toHaveBeenCalledWith(
    "lensdesk:tool-event:app.spelling",
    expect.anything(),
  );
});
