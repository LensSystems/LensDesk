import { describe, expect, it, vi } from "vitest";
import { createHostBridge } from "./host-channels.ts";

describe("host bridge", () => {
  it("rechaza canales fuera de la lista sin llamar a IPC", async () => {
    const invoke = vi.fn();
    const bridge = createHostBridge(invoke, () => () => undefined);

    await expect(
      (bridge.invoke as (channel: string, payload: unknown) => Promise<unknown>)("unknown", {}),
    ).resolves.toMatchObject({ ok: false, error: { code: "E_METHOD_NOT_FOUND" } });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("no se suscribe a eventos fuera de la lista permitida", () => {
    const subscribe = vi.fn(() => () => undefined);
    const bridge = createHostBridge(vi.fn(), subscribe);

    (bridge.on as unknown as (event: string, callback: () => void) => () => void)(
      "otro",
      () => undefined,
    );
    expect(subscribe).not.toHaveBeenCalled();
  });
});
