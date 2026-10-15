import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostEvent, HostEventPayloads, HostSettingKey } from "../shared/host-channels.ts";
import { buildContext, createSettingsHandlers, resolveTheme } from "./context.ts";
import { openHostDatabase } from "./db/driver.ts";
import { getSetting, setSetting } from "./db/settings-repo.ts";
import { createRouter } from "./ipc/router.ts";
import { ipcSchemas } from "./ipc/schemas.ts";

const temporaryDirectories: string[] = [];
const databases: ReturnType<typeof openHostDatabase>[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true });
});

function createFixture(systemIsDark = false) {
  const directory = mkdtempSync(join(tmpdir(), "lensdesk-context-"));
  temporaryDirectories.push(directory);
  const database = openHostDatabase(directory);
  databases.push(database);
  const emit = vi.fn(<E extends HostEvent>(event: E, payload: HostEventPayloads[E]) => {
    void event;
    void payload;
  });
  const handlers = createSettingsHandlers({
    repo: {
      get: (key: HostSettingKey) => getSetting(database, key),
      set: (key: HostSettingKey, value: unknown) => setSetting(database, key, value),
    },
    emit,
    getSystemIsDark: () => systemIsDark,
  });
  return { database, emit, handlers };
}

describe("contexto y ajustes", () => {
  it("resuelve el tema del sistema y conserva los temas explícitos", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(buildContext({ locale: "en", themeSetting: "system", systemIsDark: true })).toEqual({
      locale: "en",
      theme: "dark",
    });
  });

  it("devuelve el contexto por defecto usando el tema del sistema", () => {
    const { handlers } = createFixture(true);
    expect(handlers["app.getContext"]()).toEqual({ locale: "es", theme: "dark" });
  });

  it("no consulta el tema del sistema cuando hay un tema explícito", () => {
    const { database } = createFixture();
    setSetting(database, "theme", "light");
    const getSystemIsDark = vi.fn(() => true);
    const explicitThemeHandlers = createSettingsHandlers({
      repo: {
        get: (key) => getSetting(database, key),
        set: (key, value) => setSetting(database, key, value),
      },
      emit: vi.fn(),
      getSystemIsDark,
    });
    expect(explicitThemeHandlers["app.getContext"]()).toEqual({ locale: "es", theme: "light" });
    expect(getSystemIsDark).not.toHaveBeenCalled();
  });

  it("persiste ajustes y emite ambos eventos cuando cambia el contexto", () => {
    const { database, emit, handlers } = createFixture();
    expect(handlers["settings.set"]({ key: "theme", value: "dark" })).toEqual({
      key: "theme",
      value: "dark",
    });
    expect(getSetting(database, "theme")).toBe("dark");
    expect(emit.mock.calls).toEqual([
      ["settings.changed", { key: "theme", value: "dark" }],
      ["context.changed", { locale: "es", theme: "dark" }],
    ]);

    handlers["settings.set"]({ key: "developerMode", value: true });
    expect(emit).toHaveBeenLastCalledWith("settings.changed", {
      key: "developerMode",
      value: true,
    });
  });

  it("rechaza valores inválidos por IPC sin escribir ni emitir eventos", async () => {
    const { database, emit, handlers } = createFixture();
    const router = createRouter({
      schemas: ipcSchemas,
      handlers: { "app.getInfo": () => ({ version: "1", platform: "darwin" }), ...handlers },
      isShellSender: () => true,
    });
    await expect(
      router({}, "settings.set", { key: "theme", value: "sepia" }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "E_INVALID_PARAMS" },
    });
    expect(getSetting(database, "theme")).toBe("system");
    expect(emit).not.toHaveBeenCalled();
  });
});
