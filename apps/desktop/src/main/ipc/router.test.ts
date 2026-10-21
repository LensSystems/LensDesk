import { describe, expect, it, vi } from "vitest";
import { HOST_CHANNELS } from "../../shared/host-channels.ts";
import { createRouter } from "./router.ts";
import { ipcSchemas } from "./schemas.ts";

const unusedHandlers = {
  "settings.get": () => ({ key: "locale" as const, value: "es" }),
  "settings.set": () => ({ key: "locale" as const, value: "es" }),
  "app.getContext": () => ({ locale: "es" as const, theme: "dark" as const }),
  "tabs.list": () => ({ tabs: [] }),
  "tabs.open": () => ({ tabs: [] }),
  "tabs.close": () => ({ tabs: [] }),
  "tabs.undoClose": () => ({ tabs: [] }),
  "tabs.activate": () => ({ tabs: [] }),
  "shell.showPage": ({ page }: { page: "tools" | "settings" }) => ({ page }),
  "tools.list": () => ({ tools: [], pendingDowngrade: null }),
  "tools.pickAndInstall": () => ({ tools: [], pendingDowngrade: null }),
  "tools.installFromPath": () => ({ tools: [], pendingDowngrade: null }),
  "tools.confirmDowngrade": () => ({ tools: [], pendingDowngrade: null }),
  "tools.setEnabled": () => ({ tools: [], pendingDowngrade: null }),
  "tools.remove": () => ({ tools: [], pendingDowngrade: null }),
  "logs.export": () => ({ saved: false }),
  "app.openDataFolder": () => ({}),
  "app.openExternal": () => ({}),
  "updates.checkNow": () => ({ kind: "skipped" as const }),
};

describe("IPC router", () => {
  it("declara un esquema para cada canal host y ninguno adicional", () => {
    expect(Object.keys(ipcSchemas).sort()).toEqual([...HOST_CHANNELS].sort());
  });

  it("valida el estado pendiente en las respuestas de herramientas", () => {
    const state = {
      tools: [],
      pendingDowngrade: {
        toolId: "sample-tool",
        installedVersion: "2.0.0",
        version: "1.0.0",
      },
    };
    expect(ipcSchemas["tools.list"].response.safeParse(state).success).toBe(true);
    expect(ipcSchemas["tools.list"].response.safeParse({ tools: [] }).success).toBe(false);
  });

  it("valida la respuesta de app.getInfo", async () => {
    expect(
      ipcSchemas["app.getInfo"].response.safeParse({ version: "1", platform: "darwin" }).success,
    ).toBe(false);
    expect(
      ipcSchemas["app.getInfo"].response.safeParse({
        version: "1",
        platform: "darwin",
        fullScreen: "true",
      }).success,
    ).toBe(false);
    const router = createRouter({
      schemas: ipcSchemas,
      handlers: {
        ...unusedHandlers,
        "app.getInfo": () => ({ version: "1.0.0", platform: "darwin", fullScreen: false }),
      },
      isShellSender: () => true,
    });
    await expect(router({}, "app.getInfo", {})).resolves.toEqual({
      ok: true,
      data: { version: "1.0.0", platform: "darwin", fullScreen: false },
    });
  });

  it("rechaza parámetros no válidos antes de ejecutar el handler", async () => {
    const handler = vi.fn(() => ({ version: "1.0.0", platform: "darwin", fullScreen: false }));
    const router = createRouter({
      schemas: ipcSchemas,
      handlers: { ...unusedHandlers, "app.getInfo": handler },
      isShellSender: () => true,
    });
    await expect(router({}, "app.getInfo", { extra: true })).resolves.toMatchObject({
      ok: false,
      error: { code: "E_INVALID_PARAMS" },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("rechaza emisores ajenos al shell", async () => {
    const handler = vi.fn(() => ({ version: "1.0.0", platform: "darwin", fullScreen: false }));
    const router = createRouter({
      schemas: ipcSchemas,
      handlers: { ...unusedHandlers, "app.getInfo": handler },
      isShellSender: (sender) => sender === "shell",
    });
    await expect(router("tool", "app.getInfo", {})).resolves.toMatchObject({
      ok: false,
      error: { code: "E_PERMISSION_DENIED" },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("rechaza canales desconocidos", async () => {
    const router = createRouter({
      schemas: ipcSchemas,
      handlers: {
        ...unusedHandlers,
        "app.getInfo": () => ({ version: "1", platform: "darwin", fullScreen: false }),
      },
      isShellSender: () => true,
    });
    await expect(router({}, "unknown", {})).resolves.toMatchObject({
      ok: false,
      error: { code: "E_METHOD_NOT_FOUND" },
    });
  });

  it("app.openExternal solo acepta https y no ejecuta el handler con otro esquema", async () => {
    const handler = vi.fn(() => ({}));
    const router = createRouter({
      schemas: ipcSchemas,
      handlers: {
        ...unusedHandlers,
        "app.getInfo": () => ({ version: "1", platform: "darwin", fullScreen: false }),
        "app.openExternal": handler,
      },
      isShellSender: () => true,
    });
    for (const url of ["http://example.com", "file:///etc/hosts", "javascript:alert(1)", "x"])
      await expect(router({}, "app.openExternal", { url })).resolves.toMatchObject({
        ok: false,
        error: { code: "E_INVALID_PARAMS" },
      });
    expect(handler).not.toHaveBeenCalled();
    await expect(
      router({}, "app.openExternal", { url: "https://github.com/o/r" }),
    ).resolves.toEqual({ ok: true, data: {} });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("valida las respuestas de logs.export y updates.checkNow", () => {
    expect(ipcSchemas["logs.export"].response.safeParse({ saved: true }).success).toBe(true);
    const checkNow = ipcSchemas["updates.checkNow"].response;
    expect(checkNow.safeParse({ kind: "skipped" }).success).toBe(true);
    expect(
      checkNow.safeParse({ kind: "available", version: "1.0.0", url: "https://github.com/o/r" })
        .success,
    ).toBe(true);
    expect(
      checkNow.safeParse({ kind: "available", version: "1.0.0", url: "http://github.com/o/r" })
        .success,
    ).toBe(false);
    expect(checkNow.safeParse({ kind: "available" }).success).toBe(false);
  });
});
