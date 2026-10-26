import { TooltipProvider } from "@lensdesk/ui";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ipcSchemas } from "../../../main/ipc/schemas.ts";
import type { HostBridge, HostChannel, UpdateCheckResult } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { SettingsPage } from "./SettingsPage.tsx";

function renderSettings(
  options: { repo?: string; check?: () => Promise<UpdateCheckResult>; failure?: boolean } = {},
) {
  const invoke = vi.fn(async (channel: HostChannel, payload: unknown) => {
    ipcSchemas[channel].request.parse(payload);
    if (channel === "updates.checkNow" && options.failure)
      return { ok: false, error: { code: "E_INTERNAL", message: "error" } };
    const data =
      channel === "app.getInfo"
        ? {
            version: "0.1.0",
            platform: "darwin",
            fullScreen: false,
            releasesRepo: options.repo ?? "o/r",
          }
        : channel === "updates.checkNow"
          ? await (options.check?.() ?? Promise.resolve({ kind: "none" }))
          : channel === "settings.get"
            ? { key: "app.openAtLogin", value: false }
            : channel === "settings.set"
              ? payload
              : {};
    return { ok: true, data: ipcSchemas[channel].response.parse(data) };
  });
  render(
    <TooltipProvider>
      <SettingsPage bridge={{ invoke } as unknown as HostBridge} />
    </TooltipProvider>,
  );
  return invoke;
}

describe("Ajustes", () => {
  beforeEach(async () => {
    await rendererI18n.changeLanguage("es");
    useShellStore.setState({
      update: null,
      updateSettingsRequest: 0,
      context: { locale: "es", theme: "dark", accent: "blue" },
      settings: {
        locale: "es",
        theme: "system",
        accent: "blue",
        developerMode: false,
        updatesCheck: true,
      },
    });
  });
  afterEach(cleanup);

  it("agrupa los ajustes en cuatro secciones con encabezados", async () => {
    renderSettings();
    for (const name of ["Apariencia", "General", "Datos y registros", "Acerca de"]) {
      const section = screen.getByRole("region", { name });
      expect(within(section).getByRole("heading", { name, level: 2 })).toBeTruthy();
    }
    expect(screen.getAllByRole("region")).toHaveLength(4);
    expect(await screen.findByText("Versión 0.1.0")).toBeTruthy();
  });

  it("muestra la identidad y el isotipo verde del contexto", async () => {
    useShellStore.setState({ context: { locale: "es", theme: "dark", accent: "green" } });
    renderSettings();
    const section = screen.getByRole("region", { name: "Acerca de" });
    expect(
      within(section).getByText(
        (_, element) => element?.tagName === "P" && element.textContent === "LensDesk",
      ),
    ).toBeTruthy();
    expect(within(section).getByText("de LensSystems")).toBeTruthy();
    expect(
      within(section).getByText(
        "Escritorio de herramientas para desarrolladores. 100 % local. Licencia MIT.",
      ),
    ).toBeTruthy();
    expect(section.querySelector("svg rect")).toHaveAttribute("fill", "#2F7D5B");
    expect(section.querySelector("svg tspan")).toHaveAttribute("fill", "#2F7D5B");
    await screen.findByText("Versión 0.1.0");
  });

  it("asocia las descripciones a los switches", async () => {
    renderSettings();
    expect(
      screen.getByRole("switch", { name: "Buscar actualizaciones" }),
    ).toHaveAccessibleDescription("LensDesk comprueba una vez al día si existe una versión nueva.");
    expect(screen.getByRole("switch", { name: "Modo desarrollador" })).toHaveAccessibleDescription(
      "Permite instalar herramientas sin firmar.",
    );
    await screen.findByText("Versión 0.1.0");
  });

  it("guarda el acento Verde al pulsar su radio", async () => {
    const invoke = renderSettings();
    const group = screen.getByRole("radiogroup", { name: "Color de acento" });
    fireEvent.click(within(group).getByRole("radio", { name: "Verde" }));
    expect(invoke).toHaveBeenCalledWith("settings.set", { key: "accent", value: "green" });
    expect(within(group).getByRole("radio", { name: "Azul" })).toBeTruthy();
    await screen.findByText("Versión 0.1.0");
  });

  it("guarda el tema Claro al pulsar su radio", async () => {
    const invoke = renderSettings();
    const group = screen.getByRole("radiogroup", { name: "Tema" });
    fireEvent.click(within(group).getByRole("radio", { name: "Claro" }));
    expect(invoke).toHaveBeenCalledWith("settings.set", { key: "theme", value: "light" });
    await screen.findByText("Versión 0.1.0");
  });

  it("guarda el tema Claro al navegar con la flecha derecha", async () => {
    const invoke = renderSettings();
    const group = screen.getByRole("radiogroup", { name: "Tema" });
    const system = within(group).getByRole("radio", { name: "Sistema" });
    act(() => system.focus());
    fireEvent.keyDown(system, { key: "ArrowRight" });
    await waitFor(() => {
      expect(within(group).getByRole("radio", { name: "Claro" })).toHaveFocus();
      expect(invoke).toHaveBeenCalledWith("settings.set", { key: "theme", value: "light" });
    });
  });
  it("busca solo al pulsar y muestra la versión actual tras terminar", async () => {
    let finish!: (result: UpdateCheckResult) => void;
    const invoke = renderSettings({
      check: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const button = await screen.findByRole("button", { name: "Buscar ahora" });
    expect(invoke).not.toHaveBeenCalledWith("updates.checkNow", {});
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Buscar ahora" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Buscar ahora" }));
    expect(invoke.mock.calls.filter(([channel]) => channel === "updates.checkNow")).toHaveLength(1);
    await act(async () => finish({ kind: "none" }));
    expect(screen.getByRole("status")).toHaveTextContent("LensDesk está actualizado (0.1.0)");
  });

  it("abre la versión nueva con la misma acción del aviso", async () => {
    const url = "https://github.com/o/r/releases/v1.0.0";
    const invoke = renderSettings({
      check: async () => ({ kind: "available", version: "1.0.0", url }),
    });
    fireEvent.click(await screen.findByRole("button", { name: "Buscar ahora" }));
    fireEvent.click(await screen.findByRole("link", { name: "Versión 1.0.0 disponible" }));
    expect(invoke).toHaveBeenCalledWith("app.openExternal", { url });
  });

  it.each(["error", "ipc"] as const)("permite reintentar tras un fallo %s", async (failure) => {
    const check = vi
      .fn<() => Promise<UpdateCheckResult>>()
      .mockResolvedValueOnce({ kind: "error" })
      .mockResolvedValue({ kind: "none" });
    const invoke = renderSettings({ check, failure: failure === "ipc" });
    fireEvent.click(await screen.findByRole("button", { name: "Buscar ahora" }));
    await screen.findByText("No se pudo comprobar. Revisa la conexión.");
    const retry = screen.getByRole("button", { name: "Buscar ahora" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "No se pudo comprobar. Revisa la conexión.",
    );
    fireEvent.click(retry);
    await waitFor(() =>
      expect(invoke.mock.calls.filter(([channel]) => channel === "updates.checkNow")).toHaveLength(
        2,
      ),
    );
    if (failure === "error")
      expect(await screen.findByText("LensDesk está actualizado (0.1.0)")).toBeTruthy();
  });

  it("no presenta skipped como una comprobación al día", async () => {
    renderSettings({ check: async () => ({ kind: "skipped" }) });
    fireEvent.click(await screen.findByRole("button", { name: "Buscar ahora" }));
    await screen.findByRole("button", { name: "Buscar ahora" });
    expect(screen.queryByText("LensDesk está actualizado (0.1.0)")).toBeNull();
  });

  it.each(["empty", "disabled"] as const)("oculta la acción sin consultar: %s", async (reason) => {
    if (reason === "disabled")
      useShellStore.setState((state) => ({ settings: { ...state.settings, updatesCheck: false } }));
    const invoke = renderSettings({ repo: reason === "empty" ? "" : "o/r" });
    await screen.findByText("Versión 0.1.0");
    expect(screen.queryByRole("button", { name: "Buscar ahora" })).toBeNull();
    expect(invoke).not.toHaveBeenCalledWith("updates.checkNow", {});
  });
});
