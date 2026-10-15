import { createToolClient, LensError } from "@lensdesk/sdk";
import { describe, expect, it, vi } from "vitest";
import { createToolBridge, registerDroppedFiles } from "./tool-channels.ts";

describe("tool bridge", () => {
  it("converts dropped File paths into file handles without exposing the paths", async () => {
    const files = [{ name: "local.txt" }, { name: "second.txt" }] as File[];
    const getPath = vi.fn((file: File) => `/private/${file.name}`);
    const handles = [{ token: "one", name: "local.txt", size: 3 }];
    const register = vi.fn(async () => handles);
    await expect(registerDroppedFiles(files, getPath, register)).resolves.toEqual(handles);
    expect(register).toHaveBeenCalledWith(["/private/local.txt", "/private/second.txt"]);
    expect(JSON.stringify(handles)).not.toContain("/private/");
  });

  it("works through the SDK client and unsubscribes context listeners", async () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const subscribe = vi.fn((event: string, callback: (payload: unknown) => void) => {
      listeners.set(event, callback);
      return () => listeners.delete(event);
    });
    const bridge = createToolBridge(async (channel) => {
      if (channel === "storage.get") return { ok: true, data: { saved: true } };
      return { ok: false, error: { code: "E_PERMISSION_DENIED", message: "denied" } };
    }, subscribe);
    const client = createToolClient(bridge);
    await expect(client.storage.get("x")).resolves.toEqual({ saved: true });
    await expect(client.storage.set("x", 1)).rejects.toBeInstanceOf(LensError);
    const onContextChange = vi.fn();
    const unsubscribe = client.app.onContextChange(onContextChange);
    listeners.get("app.contextChanged")?.({
      locale: "en",
      theme: "dark",
      hostVersion: "1",
      toolVersion: "1",
    });
    expect(onContextChange).toHaveBeenCalledOnce();
    unsubscribe();
    expect(listeners.has("app.contextChanged")).toBe(false);
  });
});
