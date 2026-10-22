import { describe, expect, it, vi } from "vitest";
import type { BackendProgressEvent, ToolBridge } from "./api.ts";
import { createToolClient } from "./client.ts";
import { LensError } from "./errors.ts";

function makeBridge() {
  let progressCallback: ((event: BackendProgressEvent) => void) | undefined;
  const unsubscribeProgress = vi.fn(() => {});
  const bridge: ToolBridge = {
    storage: {
      get: vi.fn(async () => ({ ok: true as const, data: "stored" })),
      set: vi.fn(async () => ({ ok: true as const, data: undefined })),
      delete: vi.fn(async () => ({ ok: true as const, data: undefined })),
      keys: vi.fn(async () => ({ ok: true as const, data: ["key"] })),
    },
    files: {
      pickOpen: vi.fn(async () => ({ ok: true as const, data: [] })),
      pickSave: vi.fn(async () => ({ ok: true as const, data: null })),
      readText: vi.fn(async () => ({ ok: true as const, data: "text" })),
      readBytes: vi.fn(async () => ({ ok: true as const, data: new Uint8Array([1]) })),
      writeText: vi.fn(async () => ({ ok: true as const, data: undefined })),
      onDrop: vi.fn(() => () => {}),
    },
    backend: {
      invoke: vi.fn(async () => ({ ok: true as const, data: "done" })),
      cancel: vi.fn(async () => ({ ok: true as const, data: undefined })),
      onProgress: vi.fn((callback) => {
        progressCallback = callback;
        return unsubscribeProgress;
      }),
    },
    app: {
      getContext: vi.fn(async () => ({
        ok: true as const,
        data: { locale: "es", theme: "dark", hostVersion: "1.0.0", toolVersion: "1.0.0" },
      })),
      onContextChange: vi.fn(() => () => {}),
      onVisibilityChange: vi.fn(() => () => {}),
    },
    ui: {
      toast: vi.fn(async () => ({ ok: true as const, data: undefined })),
      copyText: vi.fn(async () => ({ ok: true as const, data: undefined })),
      openExternal: vi.fn(async () => ({ ok: true as const, data: undefined })),
    },
  };
  return {
    bridge,
    emitProgress: (event: BackendProgressEvent) => progressCallback?.(event),
    unsubscribeProgress,
  };
}

describe("createToolClient", () => {
  it("devuelve data con ok y lanza LensError con el mismo code sin ok", async () => {
    const { bridge } = makeBridge();
    vi.mocked(bridge.storage.get).mockResolvedValueOnce({
      ok: false,
      error: { code: "E_PERMISSION_DENIED", message: "sin permiso" },
    });
    const client = createToolClient(bridge);
    await expect(client.storage.get("x")).rejects.toSatisfy(
      (error) =>
        error instanceof LensError &&
        error.code === "E_PERMISSION_DENIED" &&
        error.message === "sin permiso",
    );
    await expect(client.storage.keys()).resolves.toEqual(["key"]);
  });

  it("lanza LensError cuando backend.invoke responde con error", async () => {
    const { bridge } = makeBridge();
    vi.mocked(bridge.backend.invoke).mockResolvedValueOnce({
      ok: false,
      error: { code: "E_METHOD_NOT_FOUND", message: "no existe" },
    });
    const client = createToolClient(bridge);
    await expect(client.backend.invoke("missing")).rejects.toSatisfy(
      (error) => error instanceof LensError && error.code === "E_METHOD_NOT_FOUND",
    );
  });
});

describe("createToolClient backend invoke", () => {
  it("filters progress by request, unsubscribes and sends only serializable arguments", async () => {
    const { bridge, emitProgress, unsubscribeProgress } = makeBridge();
    const client = createToolClient(bridge);
    const onProgress = vi.fn();
    await expect(client.backend.invoke("convert", { token: "a" }, { onProgress })).resolves.toBe(
      "done",
    );
    const call = vi.mocked(bridge.backend.invoke).mock.calls[0];
    if (!call) throw new Error("backend.invoke was not called");
    const [requestId, method, params] = call;
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect([method, params]).toEqual(["convert", { token: "a" }]);
    emitProgress({ requestId: "another", fraction: 0.1 });
    emitProgress({ requestId, fraction: 0.75, message: "Almost done" });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({ fraction: 0.75, message: "Almost done" });
    expect(unsubscribeProgress).toHaveBeenCalledOnce();
  });

  it("cancels an in-flight request and rejects an already-aborted signal without invoking", async () => {
    const { bridge } = makeBridge();
    vi.mocked(bridge.backend.invoke).mockReturnValue(new Promise(() => {}));
    const client = createToolClient(bridge);
    const controller = new AbortController();
    const pending = client.backend.invoke("long", {}, { signal: controller.signal });
    const call = vi.mocked(bridge.backend.invoke).mock.calls[0];
    if (!call) throw new Error("backend.invoke was not called");
    const [requestId] = call;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "E_CANCELLED" });
    expect(bridge.backend.cancel).toHaveBeenCalledWith(requestId);

    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    vi.mocked(bridge.backend.invoke).mockClear();
    await expect(
      client.backend.invoke("never", {}, { signal: alreadyAborted.signal }),
    ).rejects.toMatchObject({ code: "E_CANCELLED" });
    expect(bridge.backend.invoke).not.toHaveBeenCalled();
  });

  it("en un host sin el evento de visibilidad, suscribirse no falla", () => {
    const { bridge } = makeBridge();
    const { onVisibilityChange: _absent, ...oldApp } = bridge.app;
    const client = createToolClient({ ...bridge, app: oldApp });
    const unsubscribe = client.app.onVisibilityChange(() => undefined);
    expect(() => unsubscribe()).not.toThrow();
  });
});

it("ortografía compatible con hosts anteriores y cancelable", () => {
  const { bridge } = makeBridge();
  const callback = vi.fn();
  expect(createToolClient(bridge).app.onSpelling(callback)()).toBeUndefined();
  const stop = vi.fn();
  bridge.app.onSpelling = vi.fn((receive) => {
    receive({ word: "holaa", suggestions: ["hola"] });
    return stop;
  });
  createToolClient(bridge).app.onSpelling(callback)();
  expect(callback).toHaveBeenCalledWith({ word: "holaa", suggestions: ["hola"] });
  expect(stop).toHaveBeenCalledOnce();
});
