import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { SettingsPage } from "./SettingsPage.tsx";

function renderSettings() {
  const invoke = vi.fn(async () => ({ ok: true, data: { version: "1.0.0" } }));
  render(<SettingsPage bridge={{ invoke } as unknown as HostBridge} />);
  return invoke;
}

describe("Ajustes", () => {
  beforeEach(async () => {
    await rendererI18n.changeLanguage("es");
    useShellStore.setState({
      settings: { locale: "es", theme: "system", developerMode: false, updatesCheck: true },
    });
  });
  afterEach(cleanup);

  it("agrupa los ajustes en tres secciones con encabezados", async () => {
    renderSettings();
    for (const name of ["Apariencia", "General", "Datos y registros"]) {
      const section = screen.getByRole("region", { name });
      expect(within(section).getByRole("heading", { name, level: 2 })).toBeTruthy();
    }
    expect(screen.getAllByRole("region")).toHaveLength(3);
    expect(await screen.findByText("Acerca de · LensDesk 1.0.0")).toBeTruthy();
  });

  it("asocia las descripciones a los switches", async () => {
    renderSettings();
    expect(
      screen.getByRole("switch", { name: "Buscar actualizaciones" }),
    ).toHaveAccessibleDescription("Una vez al día, LensDesk consulta si hay una versión nueva.");
    expect(screen.getByRole("switch", { name: "Modo desarrollador" })).toHaveAccessibleDescription(
      "Permite instalar herramientas sin firmar.",
    );
    await screen.findByText("Acerca de · LensDesk 1.0.0");
  });

  it("guarda el tema Claro al pulsar su radio", async () => {
    const invoke = renderSettings();
    const group = screen.getByRole("radiogroup", { name: "Tema" });
    fireEvent.click(within(group).getByRole("radio", { name: "Claro" }));
    expect(invoke).toHaveBeenCalledWith("settings.set", { key: "theme", value: "light" });
    await screen.findByText("Acerca de · LensDesk 1.0.0");
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
