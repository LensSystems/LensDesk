import { TooltipProvider } from "@lensdesk/ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostBridge, ToolSummary } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { ToolsPage } from "./ToolsPage.tsx";

const tool = (enabled = true): ToolSummary => ({
  id: "notas",
  version: "1.2.0",
  manifest: {
    name: { es: "Notas", en: "Notes" },
    description: { es: "Apunta ideas", en: "Write ideas" },
    icon: "NotebookPen",
    permissions: ["storage"],
  },
  enabled,
  signed: false,
  keyId: null,
  installedAt: "",
  updatedAt: "",
});
function bridgeMock() {
  const listeners = new Map<string, (payload: unknown) => void>();
  const invoke = vi.fn(async (channel: string) =>
    channel === "tools.pickAndInstall" || channel === "tools.installFromPath"
      ? { ok: false as const, error: { code: "E_SIGNATURE_INVALID", message: "bad" } }
      : { ok: true as const, data: {} },
  );
  return {
    bridge: {
      invoke,
      on: (event: string, cb: (payload: unknown) => void) => {
        listeners.set(event, cb);
        return () => listeners.delete(event);
      },
      pathForFile: () => "/tmp/tool.lenspkg",
    } as unknown as HostBridge,
    invoke,
    listeners,
  };
}

describe("página Herramientas", () => {
  it("muestra la insignia de firma válida", () => {
    const { bridge } = bridgeMock();
    useShellStore.setState({ tools: [{ ...tool(), signed: true }], pendingDowngrade: null });
    render(
      <TooltipProvider>
        <ToolsPage bridge={bridge} />
      </TooltipProvider>,
    );
    expect(screen.getByText("firmada").className).toContain("bg-accent-soft");
    expect(screen.queryByText("sin firmar")).toBeNull();
  });

  it("muestra nombre, descripción localizados, insignia, icono y abre herramienta activa", async () => {
    await rendererI18n.changeLanguage("es");
    const { bridge, invoke } = bridgeMock();
    useShellStore.setState({ tools: [tool()], pendingDowngrade: null });
    render(
      <TooltipProvider>
        <ToolsPage bridge={bridge} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir Notas" }));
    expect(invoke).toHaveBeenCalledWith("tabs.open", { toolId: "notas" });
    expect(screen.getByText("sin firmar").className).toContain("bg-warning-soft");
    expect(screen.getByText("v1.2.0")).toBeTruthy();
    expect(screen.getByText("Apunta ideas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir Notas" }).textContent).toBe("Abrir");
    expect(screen.queryByRole("button", { name: "Notas" })).toBeNull();
  });

  it("deshabilita tarjeta, ofrece acciones por teclado y muestra detalles", async () => {
    const { bridge, invoke } = bridgeMock();
    useShellStore.setState({ tools: [tool(false)], pendingDowngrade: null });
    render(
      <TooltipProvider>
        <ToolsPage bridge={bridge} />
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Abrir Notas" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Desactivada. Actívala desde el menú para abrirla.")).toBeTruthy();
    const trigger = screen.getByRole("button", { name: "Acciones de Notas" });
    expect(trigger.hasAttribute("disabled")).toBe(false);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Ver detalles" }), { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(within(screen.getByRole("dialog")).getByText(/1.2.0/)).toBeTruthy();
    expect(invoke).not.toHaveBeenCalledWith("tabs.open", expect.anything());
  });

  it("agrega, maneja errores, instala solo paquetes arrastrados y espera evento de cambios", async () => {
    const { bridge, invoke, listeners } = bridgeMock();
    useShellStore.setState({ tools: [], pendingDowngrade: null });
    useShellStore.setState({ tools: [], pendingDowngrade: null });
    const { container } = render(
      <TooltipProvider>
        <ToolsPage bridge={bridge} />
      </TooltipProvider>,
    );
    expect(screen.getByText("Elige un archivo .lenspkg")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agregar herramienta…" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getByText(/firma de la herramienta/)).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    if (!main) throw new Error("No se encontró la página Herramientas");
    fireEvent.drop(main, {
      dataTransfer: { files: [new File(["x"], "no.txt"), new File(["x"], "good.LENSPKG")] },
    });
    expect(invoke).toHaveBeenCalledWith("tools.installFromPath", { path: "/tmp/tool.lenspkg" });
    expect(invoke).toHaveBeenCalledTimes(2);
    listeners.get("tools.changed")?.({ tools: [tool()], pendingDowngrade: null });
    const unsubscribe = useShellStore.getState().subscribe(bridge);
    listeners.get("tools.changed")?.({ tools: [tool()], pendingDowngrade: null });
    await waitFor(() => expect(screen.getByRole("button", { name: "Abrir Notas" })).toBeTruthy());
    unsubscribe();
  });

  it("confirma downgrade solo al aceptar y retira con la preferencia de datos", async () => {
    const { bridge, invoke } = bridgeMock();
    useShellStore.setState({
      tools: [tool()],
      pendingDowngrade: { toolId: "notas", installedVersion: "2.0.0", version: "1.2.0" },
    });
    render(
      <TooltipProvider>
        <ToolsPage bridge={bridge} />
      </TooltipProvider>,
    );
    await waitFor(() => expect(screen.getByText(/versión instalada/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(invoke).not.toHaveBeenCalledWith("tools.confirmDowngrade", expect.anything());
    useShellStore.setState({ pendingDowngrade: null });
    useShellStore.setState({
      pendingDowngrade: { toolId: "notas", installedVersion: "2.0.0", version: "1.2.0" },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(invoke).toHaveBeenCalledWith("tools.confirmDowngrade", {
      toolId: "notas",
      version: "1.2.0",
    });
    const trigger = screen.getByRole("button", { name: "Acciones de Notas" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Quitar" }).className).toContain("text-danger");
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Quitar" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Eliminar también los datos" }));
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(invoke).toHaveBeenCalledWith("tools.remove", { toolId: "notas", deleteData: true });
  });

  it("la casilla de datos empieza desmarcada en cada confirmación de quitar", async () => {
    const { bridge } = bridgeMock();
    useShellStore.setState({ tools: [tool()], pendingDowngrade: null });
    render(
      <TooltipProvider>
        <ToolsPage bridge={bridge} />
      </TooltipProvider>,
    );
    const openRemove = () => {
      const trigger = screen.getByRole("button", { name: "Acciones de Notas" });
      trigger.focus();
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      fireEvent.keyDown(screen.getByRole("menuitem", { name: "Quitar" }), { key: "Enter" });
    };
    openRemove();
    const checkbox = () =>
      screen.getByRole("checkbox", { name: "Eliminar también los datos" }) as HTMLInputElement;
    fireEvent.click(checkbox());
    expect(checkbox().checked).toBe(true);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    openRemove();
    await waitFor(() => expect(checkbox().checked).toBe(false));
  });

  it("muestra el error cuando falla quitar una herramienta", async () => {
    const { bridge, invoke } = bridgeMock();
    invoke.mockImplementation(async (channel: string) =>
      channel === "tools.remove"
        ? { ok: false as const, error: { code: "E_TOOL_NOT_FOUND", message: "x" } }
        : { ok: true as const, data: {} },
    );
    useShellStore.setState({ tools: [tool()], pendingDowngrade: null });
    render(
      <TooltipProvider>
        <ToolsPage bridge={bridge} />
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Acciones de Notas" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Quitar" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(await screen.findByText("No se encontró la herramienta.")).toBeTruthy();
    expect(screen.getByText("No se pudo completar la acción")).toBeTruthy();
  });
});
