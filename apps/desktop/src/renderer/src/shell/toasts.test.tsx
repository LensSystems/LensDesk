import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { SettingsPage } from "./SettingsPage.tsx";
import { ToastRegion } from "./ToastRegion.tsx";

function bridgeWith(exportResult: unknown) {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === "logs.export") return exportResult;
    return { ok: true as const, data: { version: "1.0.0", platform: "test" } };
  });
  return { bridge: { invoke, on: () => () => undefined } as unknown as HostBridge, invoke };
}

describe("avisos del shell", () => {
  beforeEach(async () => {
    await rendererI18n.changeLanguage("es");
    useShellStore.setState({ toasts: [] });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("muestra un aviso en una región accesible y se cierra solo a los 5 s", () => {
    vi.useFakeTimers();
    render(<ToastRegion />);
    act(() => useShellStore.getState().pushToast("success", "Guardado"));
    expect(screen.getByRole("region", { name: /Notificaciones/ })).toBeTruthy();
    expect(screen.getByText("Guardado")).toBeTruthy();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText("Guardado")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.queryByText("Guardado")).toBeNull();
    expect(useShellStore.getState().toasts).toHaveLength(0);
  });

  it("pausa el aviso al pasar el ratón y conserva el tiempo restante", () => {
    vi.useFakeTimers();
    render(<ToastRegion />);
    act(() => useShellStore.getState().pushToast("info", "En pausa"));
    const viewport = screen.getByRole("region", { name: /Notificaciones/ });
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.pointerMove(viewport);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("En pausa")).toBeTruthy();
    fireEvent.pointerLeave(viewport);
    act(() => vi.advanceTimersByTime(1999));
    expect(screen.getByText("En pausa")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("status").style.opacity).toBe("0");
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("En pausa")).toBeNull();
  });

  it("localiza el cierre automático y deshacer pide restaurarlo", () => {
    const { bridge, invoke } = bridgeWith({});
    useShellStore.setState({
      toasts: [{ id: 999, kind: "info", message: "", closedToolId: "notas", openedToolId: "hash" }],
      tools: [{ id: "notas", manifest: { name: { es: "Notas", en: "Notes" } } }] as never,
    });
    render(<ToastRegion bridge={bridge} />);
    expect(screen.getByText("Se cerró Notas para abrir hash")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(invoke).toHaveBeenCalledWith("tabs.undoClose", { toolId: "notas" });
    expect(useShellStore.getState().toasts).toHaveLength(0);
  });

  it("conserva el borde de peligro de un error del shell", () => {
    render(<ToastRegion />);
    act(() => useShellStore.getState().pushToast("error", "Falló"));
    expect(screen.getByText("Falló").closest("li")?.className).toContain("border-danger");
  });

  it("muestra el nombre de la herramienta con estilo neutro y limita la cola a 3", () => {
    useShellStore.setState({
      tools: [{ id: "notas", manifest: { name: { es: "Notas", en: "Notes" } } }] as never,
    });
    render(<ToastRegion />);
    act(() => useShellStore.getState().pushToast("error", "Listo", "notas"));
    const item = screen.getByText("Notas: Listo").closest("li");
    expect(item?.className).not.toContain("border-danger");
    expect(item?.className).not.toContain("border-success");
    act(() => useShellStore.getState().pushToast("info", "a", "sin-manifiesto"));
    expect(screen.getByText("sin-manifiesto: a")).toBeTruthy();
    act(() => {
      useShellStore.getState().pushToast("info", "b");
      useShellStore.getState().pushToast("info", "c");
    });
    expect(useShellStore.getState().toasts.map((toast) => toast.message)).toEqual(["a", "b", "c"]);
    useShellStore.setState({ tools: [] });
  });

  it("se cierra a mano con el botón Descartar", () => {
    render(<ToastRegion />);
    act(() => useShellStore.getState().pushToast("info", "Hola"));
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByText("Hola")).toBeNull();
  });

  it("pinta el mensaje de una herramienta como texto plano", () => {
    let handler: ((payload: unknown) => void) | undefined;
    const bridge = {
      invoke: vi.fn(),
      on: (event: string, callback: (payload: unknown) => void) => {
        if (event === "tools.toast") handler = callback;
        return () => undefined;
      },
    } as unknown as HostBridge;
    const unsubscribe = useShellStore.getState().subscribe(bridge);
    const { container } = render(<ToastRegion />);
    act(() =>
      handler?.({ toolId: "notas", kind: "raro", message: '<img src="x" onerror="alert(1)">' }),
    );
    expect(screen.getByText('notas: <img src="x" onerror="alert(1)">')).toBeTruthy();
    expect(container.ownerDocument.querySelector("img")).toBeNull();
    expect(useShellStore.getState().toasts[0]?.kind).toBe("info");
    unsubscribe();
  });

  it("Exportar registros avisa del éxito, calla al cancelar y avisa del error", async () => {
    const saved = bridgeWith({ ok: true, data: { saved: true } });
    render(<SettingsPage bridge={saved.bridge} />);
    fireEvent.click(await screen.findByRole("button", { name: "Exportar registros" }));
    await waitFor(() => expect(useShellStore.getState().toasts).toHaveLength(1));
    expect(useShellStore.getState().toasts[0]).toMatchObject({
      kind: "success",
      message: "Registros exportados.",
    });
    cleanup();

    useShellStore.setState({ toasts: [] });
    const canceled = bridgeWith({ ok: true, data: { saved: false } });
    render(<SettingsPage bridge={canceled.bridge} />);
    fireEvent.click(await screen.findByRole("button", { name: "Exportar registros" }));
    await waitFor(() => expect(canceled.invoke).toHaveBeenCalledWith("logs.export", {}));
    await act(async () => undefined);
    expect(useShellStore.getState().toasts).toHaveLength(0);
    cleanup();

    const known = bridgeWith({ ok: false, error: { code: "E_INTERNAL", message: "x" } });
    render(<SettingsPage bridge={known.bridge} />);
    fireEvent.click(await screen.findByRole("button", { name: "Exportar registros" }));
    await waitFor(() => expect(useShellStore.getState().toasts).toHaveLength(1));
    expect(useShellStore.getState().toasts[0]).toMatchObject({
      kind: "error",
      message: "Ocurrió un error interno.",
    });
    cleanup();

    useShellStore.setState({ toasts: [] });
    const unknown = bridgeWith({ ok: false, error: { code: "E_RARO", message: "x" } });
    render(<SettingsPage bridge={unknown.bridge} />);
    fireEvent.click(await screen.findByRole("button", { name: "Exportar registros" }));
    await waitFor(() => expect(useShellStore.getState().toasts).toHaveLength(1));
    expect(useShellStore.getState().toasts[0]?.message).toBe(
      "No se pudieron exportar los registros.",
    );
  });
});
