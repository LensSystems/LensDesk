import { TooltipProvider } from "@lensdesk/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { createHostBridge } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { ToolUpdateActions } from "./ToolUpdateActions.tsx";
import { UpdateBanner } from "./UpdateBanner.tsx";

afterEach(cleanup);
const page = "https://github.com/o/r/releases/tag/v0.2.0";
const download = "https://github.com/o/r/releases/download/v0.2.0/file";
function setup() {
  const invoke = vi.fn(async (channel: string, payload: unknown) => {
    expect(channel).toBe("app.openExternal");
    z.object({
      url: z
        .string()
        .max(2048)
        .url()
        .refine((url) => new URL(url).protocol === "https:"),
    })
      .strict()
      .parse(payload);
    return { ok: true, data: {} };
  });
  return { invoke, bridge: createHostBridge(invoke, () => () => {}) };
}
it("muestra la versión con una acción para Ajustes y descartar", async () => {
  await rendererI18n.changeLanguage("es");
  const onOpenSettings = vi.fn();
  const onDismiss = vi.fn();
  render(
    <TooltipProvider>
      <UpdateBanner
        update={{ version: "0.2.0", html_url: page }}
        onOpenSettings={onOpenSettings}
        onDismiss={onDismiss}
      />
    </TooltipProvider>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("LensDesk 0.2.0 está disponible");
  expect(screen.getAllByRole("button")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Ir a Ajustes" }));
  expect(onOpenSettings).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
  expect(onDismiss).toHaveBeenCalledOnce();
});
it("separa descargar herramienta de seleccionar el archivo", async () => {
  await rendererI18n.changeLanguage("es");
  const { invoke, bridge } = setup();
  const onInstall = vi.fn();
  render(
    <ToolUpdateActions
      update={{ id: "notes", version: "0.2.0", url: download }}
      bridge={bridge}
      onInstall={onInstall}
    />,
  );
  expect(screen.getByText("Actualización a 0.2.0")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Descargar" }));
  expect(invoke).toHaveBeenCalledWith("app.openExternal", { url: download });
  expect(onInstall).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Instalar archivo…" }));
  expect(onInstall).toHaveBeenCalledOnce();
});

it("limpia el aviso al instalar otra versión de la herramienta", async () => {
  const { useShellStore } = await import("../state/store.ts");
  const listeners = new Map<string, (payload: unknown) => void>();
  const bridge = createHostBridge(
    async () => ({ ok: true, data: {} }),
    (event, callback) => {
      listeners.set(event, callback);
      return () => listeners.delete(event);
    },
  );
  const tool = {
    id: "notes",
    version: "0.1.0",
    manifest: {},
    enabled: true,
    signed: true,
    keyId: "key",
    installedAt: "",
    updatedAt: "",
  };
  useShellStore.setState({ tools: [tool], toolUpdates: [] });
  const unsubscribe = useShellStore.getState().subscribe(bridge);
  listeners.get("tools.updatesAvailable")?.({
    tools: [{ id: "notes", version: "0.2.0", url: download }],
  });
  expect(useShellStore.getState().toolUpdates).toHaveLength(1);
  listeners.get("tools.changed")?.({
    tools: [{ ...tool, version: "0.2.0" }],
    pendingDowngrade: null,
  });
  expect(useShellStore.getState().toolUpdates).toEqual([]);
  unsubscribe();
  useShellStore.setState({ tools: [], toolUpdates: [] });
});
