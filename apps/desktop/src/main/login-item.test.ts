import { describe, expect, it, vi } from "vitest";
import { createLoginSettingsActions } from "./app-actions.ts";
import { createSettingsHandlers } from "./context.ts";
import { settingSchemas } from "./db/settings-repo.ts";
import { createLoginItem } from "./login-item.ts";

describe("inicio de sesión", () => {
  function setup(isPackaged = true) {
    let actual = false;
    const getLoginItemSettings = vi.fn(() => ({ openAtLogin: actual }));
    const setLoginItemSettings = vi.fn((value: { openAtLogin: boolean }) => {
      actual = value.openAtLogin;
    });
    const login = createLoginItem({ isPackaged, getLoginItemSettings, setLoginItemSettings });
    const values = new Map<string, unknown>();
    const settings = createSettingsHandlers({
      repo: {
        get: (key) => values.get(key) ?? false,
        set: (key, value) => values.set(key, settingSchemas[key].parse(value)),
      },
      emit: vi.fn(),
      getSystemIsDark: () => false,
    });
    return {
      actions: createLoginSettingsActions(settings, login),
      values,
      getLoginItemSettings,
      setLoginItemSettings,
      external: (value: boolean) => {
        actual = value;
      },
    };
  }

  it.each([true, false])("aplica y persiste %s", (value) => {
    const state = setup();
    expect(state.actions["settings.set"]({ key: "app.openAtLogin", value })).toEqual({
      key: "app.openAtLogin",
      value,
    });
    expect(state.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: value });
    expect(state.values.get("app.openAtLogin")).toBe(value);
  });

  it("lee de nuevo el estado del sistema aunque difiera del guardado", () => {
    const state = setup();
    state.actions["settings.set"]({ key: "app.openAtLogin", value: false });
    state.external(true);
    expect(state.actions["settings.get"]({ key: "app.openAtLogin" }).value).toBe(true);
    state.external(false);
    expect(state.actions["settings.get"]({ key: "app.openAtLogin" }).value).toBe(false);
    // Una lectura confirma la escritura y dos más vienen de Ajustes.
    expect(state.getLoginItemSettings).toHaveBeenCalledTimes(3);
  });

  it("rechaza valores inválidos antes de tocar el sistema o persistir", () => {
    const state = setup();
    expect(() =>
      state.actions["settings.set"]({ key: "app.openAtLogin", value: "true" }),
    ).toThrow();
    expect(state.setLoginItemSettings).not.toHaveBeenCalled();
    expect(state.values.size).toBe(0);
  });

  it("no consulta ni cambia el sistema en desarrollo", () => {
    const state = setup(false);
    expect(state.actions["settings.get"]({ key: "app.openAtLogin" }).value).toBe(false);
    expect(() => state.actions["settings.set"]({ key: "app.openAtLogin", value: true })).toThrow();
    expect(state.getLoginItemSettings).not.toHaveBeenCalled();
    expect(state.setLoginItemSettings).not.toHaveBeenCalled();
    expect(state.values.size).toBe(0);
  });

  it("no persiste si el sistema falla", () => {
    const state = setup();
    state.setLoginItemSettings.mockImplementation(() => {
      throw new Error("fallo del sistema");
    });
    expect(() => state.actions["settings.set"]({ key: "app.openAtLogin", value: true })).toThrow(
      "fallo del sistema",
    );
    expect(state.values.size).toBe(0);
  });

  it("en Windows muestra apagado si el sistema desactivó el inicio aunque siga registrado", () => {
    const login = createLoginItem({
      isPackaged: true,
      getLoginItemSettings: () => ({ openAtLogin: true, executableWillLaunchAtLogin: false }),
      setLoginItemSettings: vi.fn(),
    });
    expect(login.read()).toBe(false);
  });

  it("si el sistema no aplica el cambio, guarda y responde el estado real", () => {
    const state = setup();
    state.setLoginItemSettings.mockImplementation(() => undefined);
    expect(state.actions["settings.set"]({ key: "app.openAtLogin", value: true })).toEqual({
      key: "app.openAtLogin",
      value: false,
    });
    expect(state.values.get("app.openAtLogin")).toBe(false);
  });
});
