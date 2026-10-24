import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ipcSchemas } from "../../../main/ipc/schemas.ts";
import type { HostBridge, HostChannel } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { SettingsLoginItem } from "./SettingsLoginItem.tsx";

beforeEach(async () => {
  await rendererI18n.changeLanguage("es");
});
afterEach(cleanup);

function setup(isPackaged: boolean, value = false) {
  const invoke = vi.fn(async (channel: HostChannel, payload: unknown) => {
    ipcSchemas[channel].request.parse(payload);
    const data =
      channel === "app.getInfo"
        ? { version: "1.0.0", platform: "darwin", fullScreen: false, isPackaged }
        : channel === "settings.get"
          ? { key: "app.openAtLogin", value }
          : payload;
    return { ok: true, data: ipcSchemas[channel].response.parse(data) };
  });
  render(<SettingsLoginItem bridge={{ invoke } as unknown as HostBridge} />);
  return invoke;
}

it("deshabilita el interruptor con explicación en desarrollo", async () => {
  const invoke = setup(false);
  const toggle = screen.getByRole("switch", { name: "Abrir al iniciar sesión" });
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("settings.get", { key: "app.openAtLogin" }),
  );
  expect(toggle).toBeDisabled();
  expect(toggle).toHaveAccessibleDescription("Disponible en la app instalada");
  fireEvent.click(toggle);
  expect(invoke).not.toHaveBeenCalledWith("settings.set", expect.anything());
});

it("muestra el valor real y permite desactivarlo en la app instalada", async () => {
  const invoke = setup(true, true);
  const toggle = screen.getByRole("switch", { name: "Abrir al iniciar sesión" });
  await waitFor(() => expect(toggle).toBeEnabled());
  expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(toggle).toHaveAccessibleDescription(
    "LensDesk se abre automáticamente al encender el equipo.",
  );
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
  expect(invoke).toHaveBeenCalledWith("settings.set", { key: "app.openAtLogin", value: false });
});
