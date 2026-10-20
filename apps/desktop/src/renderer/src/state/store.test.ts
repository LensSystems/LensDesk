import { describe, expect, it, vi } from "vitest";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { useShellStore } from "./store.ts";

function fakeBridge() {
  const listeners = new Map<string, (payload: unknown) => void>();
  const invoke = vi.fn(async (channel: string) => {
    if (channel === "app.getInfo")
      return { ok: true as const, data: { version: "1", platform: "darwin", fullScreen: true } };
    if (channel === "tabs.list")
      return {
        ok: true as const,
        data: { tabs: [{ toolId: "notes", position: 0, active: true }] },
      };
    if (channel === "settings.get")
      return { ok: true as const, data: { key: "locale", value: "es" } };
    return {
      ok: true as const,
      data: { locale: "es" as const, theme: "dark" as const, accent: "blue" as const },
    };
  });
  const bridge = {
    invoke,
    on: (event: string, callback: (payload: unknown) => void) => {
      listeners.set(event, callback);
      return () => listeners.delete(event);
    },
  } as unknown as HostBridge;
  return { bridge, listeners, invoke };
}

describe("store del shell", () => {
  it("hidrata por el puente y solo aplica los cambios recibidos como eventos", async () => {
    const { bridge, listeners, invoke } = fakeBridge();
    await useShellStore.getState().hydrate(bridge);
    expect(invoke).toHaveBeenCalledWith("app.getInfo", {});
    expect(useShellStore.getState().fullScreen).toBe(true);
    expect(invoke).toHaveBeenCalledWith("tabs.list", {});
    expect(invoke).toHaveBeenCalledWith("settings.get", { key: "locale" });
    expect(invoke).toHaveBeenCalledWith("app.getContext", {});
    expect(useShellStore.getState().tabs[0]?.toolId).toBe("notes");
    const unsubscribe = useShellStore.getState().subscribe(bridge);
    listeners.get("tabs.changed")?.({ tabs: [] });
    listeners.get("settings.changed")?.({ key: "developerMode", value: true });
    listeners.get("settings.changed")?.({ key: "accent", value: "green" });
    listeners.get("context.changed")?.({ locale: "en", theme: "light", accent: "green" });
    expect(useShellStore.getState()).toMatchObject({
      tabs: [],
      settings: { developerMode: true, accent: "green" },
      context: { locale: "en", theme: "light", accent: "green" },
    });
    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it("no pisa con la respuesta de hydrate un evento recibido mientras esperaba", async () => {
    const { bridge, listeners, invoke } = fakeBridge();
    let releaseContext: () => void = () => {};
    invoke.mockImplementation(async (channel: string) => {
      if (channel === "app.getContext") {
        await new Promise<void>((resolve) => {
          releaseContext = resolve;
        });
        return {
          ok: true as const,
          data: { locale: "es" as const, theme: "dark" as const, accent: "blue" as const },
        };
      }
      if (channel === "tabs.list") return { ok: true as const, data: { tabs: [] } };
      return { ok: true as const, data: { key: "locale", value: "es" } };
    });
    const unsubscribe = useShellStore.getState().subscribe(bridge);
    const hydrating = useShellStore.getState().hydrate(bridge);
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("app.getContext", {}));
    listeners.get("context.changed")?.({ locale: "en", theme: "light", accent: "green" });
    releaseContext();
    await hydrating;
    expect(useShellStore.getState().context).toEqual({
      locale: "en",
      theme: "light",
      accent: "green",
    });
    unsubscribe();
  });

  it("conserva el evento de pantalla completa recibido antes de la respuesta", async () => {
    const { bridge, listeners, invoke } = fakeBridge();
    let release: () => void = () => {};
    const original = invoke.getMockImplementation();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === "app.getInfo") {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { ok: true as const, data: { version: "1", platform: "darwin", fullScreen: false } };
      }
      if (!original) throw new Error("Falta el puente");
      return original(channel);
    });
    useShellStore.setState({ fullScreen: false });
    const unsubscribe = useShellStore.getState().subscribe(bridge);
    const hydrating = useShellStore.getState().hydrate(bridge);
    listeners.get("window.fullScreenChanged")?.({ fullScreen: true });
    release();
    await hydrating;
    expect(useShellStore.getState().fullScreen).toBe(true);
    unsubscribe();
  });

  it("convierte app.error en un aviso localizado sin detalles", () => {
    const { bridge, listeners } = fakeBridge();
    useShellStore.setState({ toasts: [] });
    const unsubscribe = useShellStore.getState().subscribe(bridge);
    listeners.get("app.error")?.({ kind: "uncaught" });
    const [toast] = useShellStore.getState().toasts;
    expect(toast).toMatchObject({
      kind: "error",
      message: "Ocurrió un error inesperado. Los detalles están en los registros.",
    });
    unsubscribe();
  });
});
