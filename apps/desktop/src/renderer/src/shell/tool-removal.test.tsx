import { TooltipProvider } from "@lensdesk/ui";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHostBridge } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { initialUpdateState } from "../state/update-state.ts";
import { sampleTool } from "./independent-update-fixtures.ts";
import { ToolsPage } from "./ToolsPage.tsx";

beforeEach(async () => {
  await rendererI18n.changeLanguage("es");
  useShellStore.setState({
    ...initialUpdateState(),
    page: "tools",
    tools: [sampleTool()],
    pendingDowngrade: null,
  });
});
afterEach(cleanup);
async function setup(reply: (payload: unknown) => Promise<unknown>) {
  const callbacks = new Map<string, (payload: unknown) => void>();
  const invoke = vi.fn(async (channel: string, payload: unknown) =>
    channel === "tools.remove" ? reply(payload) : { ok: true, data: {} },
  );
  const bridge = createHostBridge(invoke, (event, callback) => {
    callbacks.set(event, callback);
    return () => callbacks.delete(event);
  });
  const off = useShellStore.getState().subscribe(bridge);
  render(
    <TooltipProvider>
      <ToolsPage bridge={bridge} />
    </TooltipProvider>,
  );
  const trigger = screen.getByRole("button", { name: "Acciones de Notas" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Quitar" }));
  await screen.findByRole("dialog");
  return { callbacks, invoke, off, trigger };
}

it("cancelar conserva herramientas/página y devuelve foco al disparador real", async () => {
  const f = await setup(vi.fn());
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(f.trigger).toHaveFocus());
  expect(f.invoke).not.toHaveBeenCalledWith("tools.remove", expect.anything());
  expect(useShellStore.getState()).toMatchObject({ page: "tools", tools: [sampleTool()] });
  f.off();
});
it.each([false, true])(
  "conserva deleteData=%s y enfoca encabezado tras lista real y respuesta, en ambos órdenes",
  async (deleteData) => {
    for (const eventsFirst of [false, true]) {
      let complete = () => {};
      const f = await setup(
        () =>
          new Promise((resolve) => {
            complete = () => resolve({ ok: true, data: { tools: [], pendingDowngrade: null } });
          }),
      );
      const dialog = screen.getByRole("dialog");
      if (deleteData)
        fireEvent.click(
          within(dialog).getByRole("checkbox", { name: "Eliminar también los datos" }),
        );
      fireEvent.click(within(dialog).getByRole("button", { name: "Quitar" }));
      const changed = () =>
        f.callbacks.get("tools.changed")?.({ tools: [], pendingDowngrade: null });
      if (eventsFirst) {
        act(changed);
        await act(async () => complete());
      } else {
        await act(async () => complete());
        expect(screen.getByRole("heading", { name: "Notas" })).toBeTruthy();
        act(changed);
      }
      await waitFor(() =>
        expect(screen.getByRole("heading", { level: 1, name: "Herramientas" })).toHaveFocus(),
      );
      expect(screen.getByRole("button", { name: "Agregar herramienta…" })).toBeTruthy();
      expect(f.invoke).toHaveBeenCalledWith("tools.remove", { toolId: "notes", deleteData });
      expect(f.trigger.isConnected).toBe(false);
      expect(useShellStore.getState().page).toBe("tools");
      f.off();
      cleanup();
      useShellStore.setState({ ...initialUpdateState(), tools: [sampleTool()], page: "tools" });
    }
  },
);
it.each(["reply", "reject"])(
  "fallo %s conserva Herramientas y diálogo recuperable con foco",
  async (kind) => {
    const f = await setup(async () => {
      if (kind === "reject") throw Error("offline");
      return { ok: false, error: { code: "E_INTERNAL", message: "fixture" } };
    });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Quitar" }));
    const error = await screen.findByRole("dialog", { name: "No se pudo completar la acción" });
    expect(useShellStore.getState().page).toBe("tools");
    expect(useShellStore.getState().tools).toEqual([sampleTool()]);
    fireEvent.click(within(error).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(f.trigger).toHaveFocus());
    f.off();
  },
);
