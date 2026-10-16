import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Puzzle, StickyNote } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { TooltipProvider } from "../components/ui/Tooltip.tsx";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { App } from "./App.tsx";
import { TabBar } from "./TabBar.tsx";
import { toolIcon } from "./tool-icons.ts";

function renderBar(bridge: HostBridge) {
  return render(
    <TooltipProvider>
      <TabBar bridge={bridge} tabs={tabs} />
    </TooltipProvider>,
  );
}

const tabs = [
  { toolId: "notas", position: 0, active: false },
  { toolId: "conv", position: 1, active: true },
  { toolId: "otra", position: 2, active: false },
];
const tools = [
  { id: "notas", manifest: { name: { es: "Notas", en: "Notes" } } },
  { id: "conv", manifest: { name: { es: "Convertidor", en: "Converter" } } },
] as never;

function makeBridge(dismissed: string | null = null) {
  const listeners = new Map<string, (payload: unknown) => void>();
  const invoke = vi.fn(async (channel: string, payload: { key?: string }) => {
    if (channel === "settings.get")
      return {
        ok: true as const,
        data: {
          key: payload.key,
          value: payload.key === "updates.dismissedVersion" ? dismissed : "es",
        },
      };
    if (channel === "app.getContext")
      return { ok: true as const, data: { locale: "es" as const, theme: "dark" as const } };
    if (channel === "tabs.list") return { ok: true as const, data: { tabs: [] } };
    if (channel === "tools.list")
      return { ok: true as const, data: { tools: [], pendingDowngrade: null } };
    return { ok: true as const, data: {} };
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

describe("pestañas", () => {
  beforeEach(async () => {
    await rendererI18n.changeLanguage("es");
    useShellStore.setState({ tabs, tools, page: "tab" });
  });
  afterEach(cleanup);

  it("muestra el nombre localizado y cae al id sin manifiesto", async () => {
    renderBar(makeBridge().bridge);
    expect(screen.getByRole("tab", { name: "Notas" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "otra" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar Notas" })).toBeTruthy();
    await act(() => rendererI18n.changeLanguage("en"));
    expect(screen.getByRole("tab", { name: "Notes" })).toBeTruthy();
  });

  it("actualiza el nombre de la pestaña cuando cambia la lista de herramientas", async () => {
    const { bridge, listeners } = makeBridge();
    render(<App bridge={bridge} />);
    act(() =>
      useShellStore.setState({ tabs: [tabs[0] as (typeof tabs)[0]], tools: [], page: "tab" }),
    );
    expect(screen.getByRole("tab", { name: "notas" })).toBeTruthy();
    act(() =>
      listeners.get("tools.changed")?.({
        tools: [{ id: "notas", manifest: { name: { es: "Mis notas", en: "My notes" } } }],
        pendingDowngrade: null,
      }),
    );
    expect(screen.getByRole("tab", { name: "Mis notas" })).toBeTruthy();
  });

  it("la pestaña activa lleva tabIndex 0 aunque no sea la primera", () => {
    renderBar(makeBridge().bridge);
    expect(screen.getByRole("tab", { name: "Convertidor" }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("tab", { name: "Notas" }).getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("tab", { name: "otra" }).getAttribute("tabindex")).toBe("-1");
  });

  it("vuelve a la pestaña activa al salir el foco de la barra", () => {
    render(
      <TooltipProvider>
        <TabBar bridge={makeBridge().bridge} tabs={tabs} />
        <button type="button">fuera</button>
      </TooltipProvider>,
    );
    const first = screen.getByRole("tab", { name: "Notas" });
    act(() => first.focus());
    expect(first.getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("tab", { name: "Convertidor" }).getAttribute("tabindex")).toBe("-1");
    fireEvent.blur(first, { relatedTarget: screen.getByRole("button", { name: "fuera" }) });
    expect(first.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("tab", { name: "Convertidor" }).getAttribute("tabindex")).toBe("0");
  });

  it("las flechas, Inicio y Fin mueven el foco y el clic activa", () => {
    const { bridge } = makeBridge();
    renderBar(bridge);
    const [notas, conv, otra] = ["Notas", "Convertidor", "otra"].map((name) =>
      screen.getByRole("tab", { name }),
    ) as HTMLElement[];
    act(() => conv?.focus());
    fireEvent.keyDown(conv as HTMLElement, { key: "ArrowRight" });
    expect(document.activeElement).toBe(otra);
    fireEvent.keyDown(otra as HTMLElement, { key: "ArrowRight" });
    expect(document.activeElement).toBe(notas);
    fireEvent.keyDown(notas as HTMLElement, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(otra);
    fireEvent.keyDown(otra as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(notas);
    fireEvent.keyDown(notas as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(otra);
    expect(bridge.invoke).not.toHaveBeenCalledWith("tabs.activate", expect.anything());
    fireEvent.click(otra as HTMLElement);
    expect(bridge.invoke).toHaveBeenCalledWith("tabs.activate", { toolId: "otra" });
  });
});

describe("aviso de actualización descartado", () => {
  beforeEach(async () => {
    await rendererI18n.changeLanguage("es");
    useShellStore.setState({
      tabs: [],
      tools: [],
      page: "tools",
      update: null,
      dismissedVersion: null,
    });
  });
  afterEach(cleanup);

  it("guarda la versión al descartar y no vuelve a mostrar esa versión", async () => {
    const { bridge, listeners, invoke } = makeBridge();
    render(<App bridge={bridge} />);
    act(() => listeners.get("update.available")?.({ version: "2.0.0", html_url: "https://x.y" }));
    fireEvent.click(await screen.findByRole("button", { name: "Descartar" }));
    expect(invoke).toHaveBeenCalledWith("settings.set", {
      key: "updates.dismissedVersion",
      value: "2.0.0",
    });
    act(() => listeners.get("update.available")?.({ version: "2.0.0", html_url: "https://x.y" }));
    expect(screen.queryByText("LensDesk 2.0.0 está disponible.")).toBeNull();
    act(() => listeners.get("update.available")?.({ version: "2.1.0", html_url: "https://x.y" }));
    expect(await screen.findByText("LensDesk 2.1.0 está disponible.")).toBeTruthy();
  });

  it("recuerda la versión descartada guardada al arrancar", async () => {
    const { bridge, listeners } = makeBridge("3.0.0");
    render(<App bridge={bridge} />);
    await waitFor(() => expect(useShellStore.getState().dismissedVersion).toBe("3.0.0"));
    act(() => listeners.get("update.available")?.({ version: "3.0.0", html_url: "https://x.y" }));
    expect(screen.queryByText("LensDesk 3.0.0 está disponible.")).toBeNull();
    act(() => listeners.get("update.available")?.({ version: "3.0.1", html_url: "https://x.y" }));
    expect(await screen.findByText("LensDesk 3.0.1 está disponible.")).toBeTruthy();
  });
});

describe("avisos dentro del encabezado", () => {
  afterEach(cleanup);
  it("el aviso de versión y los avisos viven dentro del header de la barra", async () => {
    await rendererI18n.changeLanguage("es");
    useShellStore.setState({
      tabs,
      tools,
      page: "tab",
      update: { version: "9.0.0", html_url: "https://x.y" },
      toasts: [{ id: 1, kind: "success", message: "Hecho" }],
    });
    render(<App bridge={makeBridge().bridge} />);
    const header = screen.getByRole("banner");
    expect(header.className).toContain("h-9");
    expect(header.contains(screen.getByText("LensDesk 9.0.0 está disponible."))).toBe(true);
    expect(header.contains(screen.getByRole("button", { name: "Ver actualización" }))).toBe(true);
    expect(header.contains(screen.getByText("Hecho"))).toBe(true);
    expect(header.contains(screen.getByRole("region", { name: /Notificaciones/ }))).toBe(true);
    useShellStore.setState({ update: null, toasts: [] });
  });
});

describe("mapa de iconos", () => {
  it("resuelve los iconos de las herramientas y cae a Puzzle", () => {
    expect(toolIcon("sticky-note")).toBe(StickyNote);
    expect(toolIcon("puzzle")).toBe(Puzzle);
    expect(toolIcon("file-output")).not.toBe(Puzzle);
    expect(toolIcon("no-existe")).toBe(Puzzle);
    expect(toolIcon("constructor")).toBe(Puzzle);
    expect(toolIcon(undefined)).toBe(Puzzle);
  });
});
