import { describe, expect, it, vi } from "vitest";
import { createAppActions, defaultLogsFileName, isHttpsUrl } from "./app-actions.ts";

function setup(picked: string | undefined) {
  const exportLogs = vi.fn(async () => undefined);
  const openExternal = vi.fn(async () => undefined);
  const openPath = vi.fn(async () => "");
  const actions = createAppActions({
    userData: "/datos",
    logsDir: "/datos/logs",
    now: () => new Date("2026-10-15T12:00:00.000Z"),
    pickSavePath: vi.fn(async () => picked),
    exportLogs,
    openPath,
    openExternal,
    checkNow: vi.fn(async () => ({ kind: "skipped" as const })),
    log: vi.fn(),
  });
  return { actions, exportLogs, openExternal, openPath };
}

describe("acciones de la app", () => {
  it("exporta los registros a la ruta elegida en el diálogo", async () => {
    const { actions, exportLogs } = setup("/elegido/logs.zip");
    await expect(actions["logs.export"]()).resolves.toEqual({ saved: true });
    expect(exportLogs).toHaveBeenCalledWith({
      logsDir: "/datos/logs",
      outFile: "/elegido/logs.zip",
    });
  });

  it("no exporta si se cancela el diálogo", async () => {
    const { actions, exportLogs } = setup(undefined);
    await expect(actions["logs.export"]()).resolves.toEqual({ saved: false });
    expect(exportLogs).not.toHaveBeenCalled();
  });

  it("abre solo enlaces https", async () => {
    const { actions, openExternal } = setup(undefined);
    await actions["app.openExternal"]({ url: "https://github.com/o/r" });
    for (const url of ["http://github.com", "file:///etc/passwd", "javascript:alert(1)", "nada"])
      await expect(actions["app.openExternal"]({ url })).rejects.toMatchObject({
        code: "E_INVALID_PARAMS",
      });
    expect(openExternal).toHaveBeenCalledTimes(1);
  });

  it("abre la carpeta de datos y falla si el sistema no puede", async () => {
    const { actions, openPath } = setup(undefined);
    await expect(actions["app.openDataFolder"]()).resolves.toEqual({});
    expect(openPath).toHaveBeenCalledWith("/datos");
    openPath.mockResolvedValueOnce("sin aplicación");
    await expect(actions["app.openDataFolder"]()).rejects.toMatchObject({ code: "E_INTERNAL" });
  });

  it("valida URL y nombre por defecto", () => {
    expect(isHttpsUrl("https://a.b")).toBe(true);
    expect(isHttpsUrl("HTTP://a.b")).toBe(false);
    expect(defaultLogsFileName(new Date("2026-10-15T12:00:00.000Z"))).toBe(
      "lensdesk-logs-2026-10-15.zip",
    );
  });
});
