import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { App } from "./App.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { ToolCrashed } from "./ToolCrashed.tsx";

function makeBridge() {
  const listeners = new Map<string, (payload: unknown) => void>();
  const invoke = vi.fn(async (channel: string) => {
    if (channel === "tabs.list")
      return {
        ok: true as const,
        data: { tabs: [{ toolId: "notas", position: 0, active: true }] },
      };
    if (channel === "app.getInfo")
      return { ok: true as const, data: { version: "1.0.0", platform: "test" } };
    if (channel === "settings.get")
      return { ok: true as const, data: { key: "locale", value: "es" } };
    if (channel === "app.getContext")
      return { ok: true as const, data: { locale: "es" as const, theme: "dark" as const } };
    if (channel === "tools.list")
      return {
        ok: true as const,
        data: {
          tools: [{ id: "notas", manifest: { name: { es: "Notas", en: "Notes" } } }],
          pendingDowngrade: null,
        },
      };
    if (channel === "shell.showPage")
      return { ok: true as const, data: { page: "settings" as const } };
    return { ok: true as const, data: { tabs: [] } };
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

describe("recuperación del shell", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useShellStore.setState({ update: null, crashedToolId: null });
  });
  it("muestra recuperación al fallar y permite recargar", async () => {
    await rendererI18n.changeLanguage("es");
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    function Broken(): never {
      throw new Error("fallo");
    }
    render(
      <ErrorBoundary
        title={rendererI18n.t("recovery.errorTitle")}
        description={rendererI18n.t("recovery.errorDescription")}
        reloadLabel={rendererI18n.t("recovery.reload")}
      >
        <Broken />
      </ErrorBoundary>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "LensDesk encontró un problema" }),
    ).toBeTruthy();
    expect(screen.getByText("La interfaz no pudo cargarse correctamente.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Recargar" }));
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("muestra aviso descartable que abre html_url", async () => {
    const { bridge, listeners, invoke } = makeBridge();
    render(<App bridge={bridge} />);
    listeners.get("update.available")?.({
      version: "2.0.0",
      html_url: "https://example.com/release",
    });
    fireEvent.click(await screen.findByRole("button", { name: "Ver actualización" }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("app.openExternal", {
        url: "https://example.com/release",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("solo muestra y reabre la herramienta activa que falló", async () => {
    const { bridge, listeners, invoke } = makeBridge();
    useShellStore.setState({
      tabs: [{ toolId: "notas", position: 0, active: true }],
      page: "tab",
      crashedToolId: null,
    });
    render(<App bridge={bridge} />);
    await screen.findByRole("main", { name: "Herramienta activa" });
    act(() => listeners.get("tool.crashed")?.({ toolId: "otra" }));
    expect(useShellStore.getState().crashedToolId).toBe("otra");
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    act(() => listeners.get("tool.crashed")?.({ toolId: "notas" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Notas dejó de funcionar" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("tabs.close", { toolId: "notas" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("tabs.open", { toolId: "notas" }));
    expect(useShellStore.getState().crashedToolId).toBeNull();
  });

  it("deshabilita el reintento y evita duplicar el cierre y la apertura", async () => {
    await rendererI18n.changeLanguage("es");
    let finishClose!: () => void;
    const closing = new Promise<void>((resolve) => {
      finishClose = resolve;
    });
    const invoke = vi.fn(async (channel: string) => {
      if (channel === "tabs.close") await closing;
      return { ok: true, data: { tabs: [] } };
    });
    const bridge = { invoke } as unknown as HostBridge;
    render(<ToolCrashed toolId="notas" bridge={bridge} />);
    const retry = screen.getByRole("button", { name: "Reintentar" });
    fireEvent.click(retry);
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(retry);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenNthCalledWith(1, "tabs.close", { toolId: "notas" });
    await act(async () => {
      finishClose();
    });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(2, "tabs.open", { toolId: "notas" });
  });

  it("ejecuta acciones de Ajustes e invoca settings.set", async () => {
    const { bridge, invoke } = makeBridge();
    useShellStore.setState({
      page: "settings",
      settings: { locale: "es", theme: "system", developerMode: false, updatesCheck: false },
    });
    render(<SettingsPage bridge={bridge} />);
    fireEvent.click(await screen.findByRole("button", { name: "Exportar registros" }));
    fireEvent.click(screen.getByRole("button", { name: "Carpeta de datos" }));
    fireEvent.click(screen.getByRole("switch", { name: "Buscar actualizaciones" }));
    expect(invoke).toHaveBeenCalledWith("logs.export", {});
    expect(invoke).toHaveBeenCalledWith("app.openDataFolder", {});
    expect(invoke).toHaveBeenCalledWith("settings.set", { key: "updates.check", value: true });
  });
});
