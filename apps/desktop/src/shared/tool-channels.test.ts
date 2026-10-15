import { createToolClient, LensError } from "@lensdesk/sdk";
import { describe, expect, it, vi } from "vitest";
import { createToolBridge } from "./tool-channels.ts";

describe("tool bridge", () => {
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
