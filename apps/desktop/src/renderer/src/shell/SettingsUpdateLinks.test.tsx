import { TooltipProvider } from "@lensdesk/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { initialUpdateState } from "../state/update-state.ts";
import { SettingsUpdateCheck } from "./SettingsUpdateCheck.tsx";

const url = "https://github.com/o/r/releases/tag/v1.0.0";
const installer = "https://github.com/o/r/releases/download/v1.0.0/installer.exe";
afterEach(cleanup);
it.each([undefined, installer])(
  "conserva enlaces descartados tras fallo de consulta y abre las URLs recibidas: %s",
  async (installerUrl) => {
    await rendererI18n.changeLanguage("es");
    useShellStore.setState({
      ...initialUpdateState(),
      update: { version: "1.0.0", html_url: url, installerUrl },
      dismissedVersion: "1.0.0",
      updateSettingsRequest: 0,
    });
    const invoke = vi.fn(async () => ({ ok: true, data: { kind: "error" } }));
    const bridge = { invoke } as unknown as HostBridge;
    const view = render(
      <TooltipProvider>
        <SettingsUpdateCheck bridge={bridge} version="0.3.0" enabled />
      </TooltipProvider>,
    );
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Versión 1.0.0 de LensDesk disponible" }));
    expect(invoke).toHaveBeenLastCalledWith("app.openExternal", { url: installerUrl ?? url });
    fireEvent.click(screen.getByRole("link", { name: "Ver novedades" }));
    expect(invoke).toHaveBeenLastCalledWith("app.openExternal", { url });
    fireEvent.click(screen.getByRole("button", { name: "Buscar ahora" }));
    await screen.findByText("No se pudo comprobar LensDesk. Vuelve a buscar.");
    expect(screen.getByText("Resultados de una búsqueda anterior.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Versión 1.0.0 de LensDesk disponible" })).toBeTruthy();
    view.unmount();
    render(
      <TooltipProvider>
        <SettingsUpdateCheck bridge={bridge} version="0.3.0" enabled={false} />
      </TooltipProvider>,
    );
    expect(screen.getByRole("link", { name: "Versión 1.0.0 de LensDesk disponible" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Buscar ahora" })).toBeNull();
  },
);
