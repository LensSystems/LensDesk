import { TooltipProvider } from "@lensdesk/ui";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ipcSchemas } from "../../../main/ipc/schemas.ts";
import type { HostBridge, HostChannel, UpdateCheckResult } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { SettingsPage } from "./SettingsPage.tsx";

function renderSettings(
  options: {
    repo?: string;
    check?: () => Promise<UpdateCheckResult>;
    failure?: boolean;
    respond?: (channel: HostChannel, payload: unknown) => Promise<unknown> | undefined;
  } = {},
) {
  const invoke = vi.fn(async (channel: HostChannel, payload: unknown) => {
    ipcSchemas[channel].request.parse(payload);
    const response = options.respond?.(channel, payload);
    if (response) return response;
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

  it("explica un ajuste rechazado, conserva el valor confirmado y permite reintentarlo", async () => {
    let attempts = 0;
    renderSettings({
      respond: (channel) => {
        if (channel !== "settings.set") return;
        attempts++;
        if (attempts === 1)
          return Promise.resolve({ ok: false, error: { code: "E_INTERNAL", message: "private" } });
        useShellStore.setState((state) => ({ settings: { ...state.settings, theme: "light" } }));
        return Promise.resolve({ ok: true, data: { key: "theme", value: "light" } });
      },
    });
    const light = screen.getByRole("radio", { name: "Claro" });
    fireEvent.click(light);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo guardar Tema");
    expect(alert).not.toHaveTextContent("private");
    expect(screen.getByRole("radio", { name: "Sistema" })).toBeChecked();
    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(light).toBeChecked());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(attempts).toBe(2);
  });

  it("ofrece reintentar la información de la aplicación tras un Result fallido", async () => {
    let attempts = 0;
    renderSettings({
      respond: (channel) => {
        if (channel !== "app.getInfo") return;
        attempts++;
        if (attempts <= 2)
          return Promise.resolve({ ok: false, error: { code: "E_INTERNAL", message: "private" } });
      },
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo cargar la información de la aplicación");
    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Versión 0.1.0")).toBeTruthy();
  });

  it("permite reintentar abrir la carpeta tras un Result fallido", async () => {
    let attempts = 0;
    renderSettings({
      respond: (channel) => {
        if (channel !== "app.openDataFolder") return;
        attempts++;
        if (attempts === 1)
          return Promise.resolve({ ok: false, error: { code: "E_INTERNAL", message: "private" } });
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Carpeta de datos" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo abrir la carpeta de datos");
    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(attempts).toBe(2);
    expect(screen.getByRole("button", { name: "Carpeta de datos" })).toHaveFocus();
  });

  it("devuelve el foco al switch apagado al reintentar sin enfocarlo en otra acción", async () => {
    let attempts = 0;
    let finish!: (result: unknown) => void;
    renderSettings({
      respond: (channel) => {
        if (channel !== "settings.set") return;
        attempts++;
        return attempts === 1
          ? Promise.resolve({ ok: false, error: { code: "E_INTERNAL", message: "private" } })
          : new Promise((resolve) => {
              finish = resolve;
            });
      },
    });
    const developer = screen.getByRole("switch", { name: "Modo desarrollador" });
    fireEvent.click(developer);
    const alert = await screen.findByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(developer).toHaveFocus();
    expect(developer).not.toBeChecked();
    expect(developer).toHaveAttribute("aria-disabled", "true");
    expect(developer).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByText("Guardando Modo desarrollador…").closest('[aria-busy="true"]'),
    ).toBeNull();
    await act(async () => finish({ ok: true, data: { key: "developerMode", value: true } }));
    expect(developer).toHaveFocus();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(developer).toHaveAttribute("aria-disabled", "false");
  });

  it("serializa una misma acción y mantiene controles independientes, foco y errores ajenos", async () => {
    let finishTheme!: (result: unknown) => void;
    const invoke = renderSettings({
      respond: (channel, payload) => {
        if (channel !== "settings.set") return;
        if ((payload as { key: string }).key === "theme")
          return new Promise((resolve) => {
            finishTheme = resolve;
          });
        return Promise.resolve({ ok: false, error: { code: "E_INTERNAL", message: "private" } });
      },
    });
    const light = screen.getByRole("radio", { name: "Claro" });
    act(() => light.focus());
    fireEvent.click(light);
    fireEvent.click(screen.getByRole("radio", { name: "Oscuro" }));
    expect(screen.getByRole("radio", { name: "Sistema" })).toBeChecked();
    expect(screen.getByText("Guardando Tema…")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Tema" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("group", { name: "Tema" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("group", { name: "Color de acento" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    expect(screen.getByText("Guardando Tema…").closest('[aria-busy="true"]')).toBeNull();
    expect(light).toHaveFocus();
    fireEvent.click(screen.getByRole("radio", { name: "Verde" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Color de acento");
    expect(invoke.mock.calls.filter(([channel]) => channel === "settings.set")).toHaveLength(2);
    await act(async () => {
      useShellStore.setState((state) => ({ settings: { ...state.settings, theme: "light" } }));
      finishTheme({ ok: true, data: { key: "theme", value: "light" } });
    });
    expect(light).toBeChecked();
    expect(screen.queryByText("Guardando Tema…")).toBeNull();
    expect(screen.getByRole("group", { name: "Tema" })).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByRole("alert")).toHaveTextContent("Color de acento");
    fireEvent.click(screen.getByRole("radio", { name: "Oscuro" }));
    expect(invoke.mock.calls.filter(([channel]) => channel === "settings.set")).toHaveLength(3);
    await act(async () =>
      finishTheme({ ok: false, error: { code: "E_INTERNAL", message: "old" } }),
    );
    expect(light).toBeChecked();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.queryByText("Guardando Tema…")).toBeNull();
  });

  it("libera una acción rechazada y traduce un error persistente al cambiar el idioma", async () => {
    let attempts = 0;
    renderSettings({
      respond: (channel) => {
        if (channel !== "app.openDataFolder") return;
        attempts++;
        return attempts === 1 ? Promise.reject(new Error("private path")) : undefined;
      },
    });
    const folder = screen.getByRole("button", { name: "Carpeta de datos" });
    act(() => folder.focus());
    fireEvent.click(folder);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo abrir");
    await act(async () => rendererI18n.changeLanguage("en"));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not open the data folder");
    expect(screen.getByRole("button", { name: "Data folder" })).toBe(folder);
    expect(folder).toHaveFocus();
    fireEvent.click(folder);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(attempts).toBe(2);
  });

  it("anuncia la carpeta ocupada sin bloquear la exportación ni suprimir su estado vivo", async () => {
    let finish!: (result: unknown) => void;
    const invoke = renderSettings({
      respond: (channel) => {
        if (channel === "app.openDataFolder")
          return new Promise((resolve) => {
            finish = resolve;
          });
        if (channel === "logs.export") return Promise.resolve({ ok: true, data: { saved: false } });
      },
    });
    const folder = screen.getByRole("button", { name: "Carpeta de datos" });
    const logs = screen.getByRole("button", { name: "Exportar registros" });
    act(() => folder.focus());
    fireEvent.click(folder);
    fireEvent.click(folder);
    expect(folder).toHaveFocus();
    expect(folder).toHaveAttribute("aria-disabled", "true");
    expect(folder).toHaveAttribute("aria-busy", "true");
    expect(logs.closest('[aria-disabled="true"]')).toBeNull();
    expect(
      screen.getByText("Abriendo la carpeta de datos…").closest('[aria-busy="true"]'),
    ).toBeNull();
    fireEvent.click(logs);
    expect(invoke.mock.calls.filter(([channel]) => channel === "app.openDataFolder")).toHaveLength(
      1,
    );
    expect(invoke).toHaveBeenCalledWith("logs.export", {});
    await act(async () => finish({ ok: true, data: {} }));
    expect(folder).toHaveAttribute("aria-disabled", "false");
    expect(folder).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByText("Abriendo la carpeta de datos…")).toBeNull();
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
