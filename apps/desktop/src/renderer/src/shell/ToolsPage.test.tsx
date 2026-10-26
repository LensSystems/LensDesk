import { TooltipProvider } from "@lensdesk/ui";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createHostBridge } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { ToolsPage } from "./ToolsPage.tsx";

afterEach(() => {
  cleanup();
  useShellStore.setState({ tools: [], toolUpdates: [] });
});
it("muestra la guía y las acciones únicamente para actualizaciones instaladas", async () => {
  await rendererI18n.changeLanguage("es");
  const invoke = vi.fn(async () => ({ ok: true, data: {} }));
  const bridge = createHostBridge(invoke, () => () => {});
  useShellStore.setState({
    tools: [
      {
        id: "template",
        version: "0.2.0",
        manifest: { name: { es: "Plantilla" }, description: { es: "Descripción" } },
        enabled: true,
        signed: false,
        keyId: null,
        installedAt: "",
        updatedAt: "",
      },
    ],
    toolUpdates: [],
    pendingDowngrade: null,
  });
  const view = render(
    <TooltipProvider>
      <ToolsPage bridge={bridge} />
    </TooltipProvider>,
  );
  expect(
    screen.queryByRole("heading", { name: "Cómo funciona la actualización de herramientas" }),
  ).toBeNull();
  useShellStore.setState({
    toolUpdates: [
      { id: "template", version: "0.3.0", url: "https://example.com/template.lenspkg" },
    ],
  });
  view.rerender(
    <TooltipProvider>
      <ToolsPage bridge={bridge} />
    </TooltipProvider>,
  );
  const guide = screen.getByRole("region", {
    name: "Cómo funciona la actualización de herramientas",
  });
  expect(within(guide).getAllByRole("listitem")).toHaveLength(4);
  expect(guide).toHaveTextContent("Una vez instalada, ya puedes abrirla desde su tarjeta.");
  expect(screen.queryByRole("button", { name: /Actualiza/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Descargar" }));
  expect(invoke).toHaveBeenCalledWith("app.openExternal", {
    url: "https://example.com/template.lenspkg",
  });
  fireEvent.click(screen.getByRole("button", { name: "Instalar archivo…" }));
  expect(invoke).toHaveBeenCalledWith("tools.pickAndInstall", {});
  useShellStore.setState({
    toolUpdates: [{ id: "other", version: "0.3.0", url: "https://example.com/other.lenspkg" }],
  });
  view.rerender(
    <TooltipProvider>
      <ToolsPage bridge={bridge} />
    </TooltipProvider>,
  );
  expect(
    screen.queryByRole("region", { name: "Cómo funciona la actualización de herramientas" }),
  ).toBeNull();
});
