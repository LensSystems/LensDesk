import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { SettingsPage } from "./SettingsPage.tsx";

function renderSettings() {
  const invoke = vi.fn(async () => ({ ok: true, data: { version: "0.1.0" } }));
  render(<SettingsPage bridge={{ invoke } as unknown as HostBridge} />);
  return invoke;
}

describe("Ajustes", () => {
  beforeEach(async () => {
    await rendererI18n.changeLanguage("es");
    useShellStore.setState({
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
});
