import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHostBridge,
  type ToolSummary,
  type UpdateCheckResult,
  type UpdateSources,
} from "../../../shared/host-channels.ts";
import { useShellStore } from "./store.ts";
import { initialUpdateState, installedUpdates } from "./update-state.ts";

const tool = (version = "0.4.0", id = "notes"): ToolSummary => ({
  id,
  version,
  manifest: {},
  enabled: true,
  signed: true,
  keyId: "release",
  installedAt: "",
  updatedAt: "",
});
const update = {
  id: "notes",
  version: "0.4.5",
  url: "https://github.com/LensSystems/LensDesk/releases/download/notes-v0.4.5/notes-0.4.5.lenspkg",
};
const app = {
  version: "0.5.0",
  html_url: "https://github.com/LensSystems/LensDesk/releases/tag/v0.5.0",
};
const blocked = {
  id: "notes",
  version: "0.6.0",
  apiVersion: 1,
  minHostVersion: "0.6.0",
  notesUrl: "https://github.com/LensSystems/LensDesk/releases/tag/notes-v0.6.0",
  reasons: ["minHostVersion" as const],
};
const sources = (): UpdateSources => ({
  app: { status: "success", update: app },
  tools: { status: "success", updates: [update], incompatible: [blocked] },
});
beforeEach(() =>
  useShellStore.setState({ ...initialUpdateState(), tools: [tool()], page: "settings" }),
);

describe("resultados persistentes del shell", () => {
  it("app none autoritativo limpia el aviso automático; error y no consultado lo conservan", () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const bridge = createHostBridge(vi.fn(), (event, callback) => {
      listeners.set(event, callback);
      return () => listeners.delete(event);
    });
    const off = useShellStore.getState().subscribe(bridge);
    listeners.get("update.available")?.(app);
    const failed = sources();
    failed.app = { status: "error", update: app };
    listeners.get("updates.checked")?.({ sources: failed });
    expect(useShellStore.getState()).toMatchObject({
      update: app,
      updateSources: { app: { status: "error" } },
    });
    listeners.get("updates.checked")?.({
      sources: { ...sources(), app: { status: "not-checked", update: app } },
    });
    expect(useShellStore.getState().update).toEqual(app);
    listeners.get("updates.checked")?.({
      sources: { ...sources(), app: { status: "success", update: null } },
    });
    expect(useShellStore.getState().update).toBeNull();
    off();
    expect(listeners.size).toBe(0);
  });
  it("reconcilia compatible e incompatible al instalar/quitar con semver de SDK", () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const invoke = vi.fn();
    const bridge = createHostBridge(invoke, (event, callback) => {
      listeners.set(event, callback);
      return () => listeners.delete(event);
    });
    const off = useShellStore.getState().subscribe(bridge);
    listeners.get("updates.checked")?.({ sources: sources() });
    listeners.get("tools.changed")?.({ tools: [tool("v0.4.5+local")], pendingDowngrade: null });
    expect(useShellStore.getState().toolUpdates).toEqual([]);
    expect(useShellStore.getState().toolIncompatible).toEqual([blocked]);
    listeners.get("tools.updatesAvailable")?.({
      tools: [update],
      incompatible: [blocked],
      status: "success",
    });
    listeners.get("tools.changed")?.({ tools: [tool("0.4.5-beta.1")], pendingDowngrade: null });
    expect(useShellStore.getState().toolUpdates).toEqual([update]);
    listeners.get("tools.changed")?.({ tools: [], pendingDowngrade: null });
    expect(useShellStore.getState()).toMatchObject({
      toolUpdates: [],
      toolIncompatible: [],
      updateSources: { tools: { updates: [], incompatible: [] } },
    });
    expect(invoke).not.toHaveBeenCalled();
    off();
  });
  it("cuenta solo IDs instalados más nuevos y deduplica sin tratar prefijos/build como otra versión", () => {
    expect(
      installedUpdates([update, update, { ...update, id: "missing" }], [tool("v0.4.0+local")]),
    ).toEqual([update]);
    expect(installedUpdates([update], [tool("v0.4.5+local")])).toEqual([]);
    expect(installedUpdates([update], [tool("0.4.5-beta.1")])).toEqual([update]);
  });
  it("persiste buscando y resultado al navegar fuera y volver, sin duplicar consulta", async () => {
    let finish = (_result: UpdateCheckResult) => {};
    const invoke = vi.fn(async (channel: string, payload: unknown) => {
      if (channel === "updates.checkNow")
        return new Promise((resolve) => {
          finish = (data) => resolve({ ok: true, data });
        });
      return { ok: true, data: payload };
    });
    const bridge = createHostBridge(invoke, () => () => {});
    const running = useShellStore.getState().checkUpdates(bridge);
    await useShellStore.getState().checkUpdates(bridge);
    await useShellStore.getState().showPage(bridge, "tools");
    expect(useShellStore.getState().updateChecking).toBe(true);
    finish({ kind: "available", version: app.version, url: app.html_url, sources: sources() });
    await running;
    await useShellStore.getState().showPage(bridge, "settings");
    expect(useShellStore.getState()).toMatchObject({
      updateChecking: false,
      updateSources: sources(),
      page: "settings",
    });
    expect(invoke.mock.calls.filter(([channel]) => channel === "updates.checkNow")).toHaveLength(1);
  });
  it("retiene datos anteriores y marca fuentes sin consultar al desactivar", () => {
    useShellStore.getState().receiveUpdateSources(sources());
    useShellStore.getState().markUpdatesUnchecked();
    expect(useShellStore.getState()).toMatchObject({
      update: app,
      toolUpdates: [update],
      updateSources: { app: { status: "not-checked" }, tools: { status: "not-checked" } },
    });
  });
  it("payloads antiguos siguen mostrando app/tools y ninguno skipped/error se interpreta como actualizado", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { kind: "available", version: app.version, url: app.html_url, tools: [update] },
      })
      .mockResolvedValueOnce({ ok: true, data: { kind: "skipped" } })
      .mockRejectedValueOnce(Error("offline"));
    const bridge = createHostBridge(invoke, () => () => {});
    await useShellStore.getState().checkUpdates(bridge);
    expect(useShellStore.getState()).toMatchObject({ update: app, toolUpdates: [update] });
    await useShellStore.getState().checkUpdates(bridge);
    expect(useShellStore.getState().updateSources?.app.status).toBe("not-checked");
    await useShellStore.getState().checkUpdates(bridge);
    expect(useShellStore.getState()).toMatchObject({
      update: app,
      toolUpdates: [update],
      updateSources: { app: { status: "error" }, tools: { status: "not-checked" } },
    });
  });
});
