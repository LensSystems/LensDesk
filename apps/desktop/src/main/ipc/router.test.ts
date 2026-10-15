import { describe, expect, it, vi } from "vitest";
import { HOST_CHANNELS } from "../../shared/host-channels.ts";
import { createRouter } from "./router.ts";
import { ipcSchemas } from "./schemas.ts";

const unusedHandlers = {
  "settings.get": () => ({ key: "locale" as const, value: "es" }),
  "settings.set": () => ({ key: "locale" as const, value: "es" }),
  "app.getContext": () => ({ locale: "es" as const, theme: "dark" as const }),
};

describe("IPC router", () => {
  it("declara un esquema para cada canal host y ninguno adicional", () => {
    expect(Object.keys(ipcSchemas).sort()).toEqual([...HOST_CHANNELS].sort());
  });

  it("valida la respuesta de app.getInfo", async () => {
    const router = createRouter({
      schemas: ipcSchemas,
      handlers: {
        ...unusedHandlers,
        "app.getInfo": () => ({ version: "1.0.0", platform: "darwin" }),
      },
      isShellSender: () => true,
    });
    await expect(router({}, "app.getInfo", {})).resolves.toEqual({
      ok: true,
      data: { version: "1.0.0", platform: "darwin" },
    });
  });

  it("rechaza parámetros no válidos antes de ejecutar el handler", async () => {
    const handler = vi.fn(() => ({ version: "1.0.0", platform: "darwin" }));
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
    const handler = vi.fn(() => ({ version: "1.0.0", platform: "darwin" }));
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
        "app.getInfo": () => ({ version: "1", platform: "darwin" }),
      },
      isShellSender: () => true,
    });
    await expect(router({}, "unknown", {})).resolves.toMatchObject({
      ok: false,
      error: { code: "E_METHOD_NOT_FOUND" },
    });
  });
});
