import { describe, expect, it, vi } from "vitest";
import type { ToolBridge, ToolContext } from "./api.ts";
import { createToolClient } from "./client.ts";
import { LENS_ERROR_CODES, LensError } from "./errors.ts";

describe("public client contract", () => {
  it("exposes and dispatches all 16 v1 methods", async () => {
    const done = async () => ({ ok: true as const, data: undefined });
    const bridge: ToolBridge = {
      storage: {
        get: vi.fn(async () => ({ ok: true as const, data: "get" })),
        set: vi.fn(done),
        delete: vi.fn(done),
        keys: vi.fn(async () => ({ ok: true as const, data: [] })),
      },
      files: {
        pickOpen: vi.fn(async () => ({ ok: true as const, data: [] })),
        pickSave: vi.fn(async () => ({ ok: true as const, data: null })),
        readText: vi.fn(async () => ({ ok: true as const, data: "text" })),
        readBytes: vi.fn(async () => ({ ok: true as const, data: new Uint8Array() })),
        writeText: vi.fn(done),
        onDrop: vi.fn(() => () => {}),
      },
      backend: {
        invoke: vi.fn(async () => ({ ok: true as const, data: "backend" })),
        cancel: vi.fn(done),
        onProgress: vi.fn(() => () => {}),
      },
      app: {
        getContext: vi.fn(async () => ({
          ok: true as const,
          data: { locale: "es", theme: "dark", hostVersion: "1", toolVersion: "1" },
        })),
        onContextChange: vi.fn(() => () => {}),
      },
      ui: { toast: vi.fn(done), copyText: vi.fn(done), openExternal: vi.fn(done) },
    };
    const client = createToolClient(bridge);
    await client.storage.get("k");
    await client.storage.set("k", 1);
    await client.storage.delete("k");
    await client.storage.keys();
    await client.files.pickOpen({});
    await client.files.pickSave({});
    await client.files.readText("t");
    await client.files.readBytes("t");
    await client.files.writeText("t", "x");
    client.files.onDrop(vi.fn());
    await client.backend.invoke("ping", {});
    await client.app.getContext();
    client.app.onContextChange(vi.fn());
    await client.ui.toast({ kind: "info", message: "x" });
    await client.ui.copyText("x");
    await client.ui.openExternal("https://example.com");
    expect(bridge.storage.get).toHaveBeenCalledWith("k");
    expect(bridge.files.onDrop).toHaveBeenCalledOnce();
    expect(bridge.app.onContextChange).toHaveBeenCalledOnce();
    expect(bridge.ui.openExternal).toHaveBeenCalledWith("https://example.com");
  });

  it("acepta contextos v1 con y sin acento", () => {
    const legacy: ToolContext = { locale: "es", theme: "dark", hostVersion: "1", toolVersion: "1" };
    expect(legacy.accent).toBeUndefined();
    const green: ToolContext = { ...legacy, accent: "green" };
    const blue: ToolContext = { ...legacy, accent: "blue" };
    expect(green.accent).toBe("green");
    expect(blue.accent).toBe("blue");
  });

  it("incluye E_NOT_FOUND como código de error estable", () => {
    expect(LENS_ERROR_CODES).toContain("E_NOT_FOUND");
    expect(LENS_ERROR_CODES).toContain("E_INTERNAL");
    expect(LENS_ERROR_CODES).toContain("E_PACKAGE_INVALID");
    expect(new LensError("E_NOT_FOUND", "x").code).toBe("E_NOT_FOUND");
  });
});
