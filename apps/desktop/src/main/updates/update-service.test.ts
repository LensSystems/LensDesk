import { describe, expect, it, vi } from "vitest";
import type { UpdateFetch } from "./check.ts";
import { createUpdateService } from "./update-service.ts";

const now = () => new Date("2026-10-15T12:00:00.000Z");
function setup(options: {
  repo?: string;
  enabled?: boolean;
  lastCheckedAt?: string | null;
  fetch?: UpdateFetch;
}) {
  const fetch =
    options.fetch ??
    vi.fn<UpdateFetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: "v1.0.0",
        html_url: "https://github.com/o/r/releases/v1.0.0",
      }),
    }));
  const setLastCheckedAt = vi.fn();
  const emit = vi.fn();
  const log = vi.fn();
  const service = createUpdateService({
    repo: options.repo ?? "o/r",
    currentVersion: "0.1.0",
    fetch,
    now,
    settings: {
      enabled: () => options.enabled ?? true,
      lastCheckedAt: () => options.lastCheckedAt ?? null,
      setLastCheckedAt,
    },
    emit,
    log,
  });
  return { service, fetch, setLastCheckedAt, emit, log };
}

describe("servicio de actualizaciones", () => {
  it("con el repositorio de la app (vacío) no hace red ni guarda nada", async () => {
    const { service, fetch, setLastCheckedAt, emit } = setup({ repo: __RELEASES_REPO__ });
    await expect(service.run(true)).resolves.toEqual({ kind: "skipped" });
    expect(fetch).not.toHaveBeenCalled();
    expect(setLastCheckedAt).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("forzar no salta el ajuste desactivado", async () => {
    const { service, fetch } = setup({ enabled: false });
    await expect(service.run(true)).resolves.toEqual({ kind: "skipped" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("emite update.available con versión y html_url y guarda la hora", async () => {
    const { service, emit, setLastCheckedAt } = setup({});
    await service.run();
    expect(emit).toHaveBeenCalledWith({
      version: "1.0.0",
      html_url: "https://github.com/o/r/releases/v1.0.0",
    });
    expect(setLastCheckedAt).toHaveBeenCalledWith("2026-10-15T12:00:00.000Z");
  });

  it("forzar ignora el intervalo de 24 h", async () => {
    const { service, fetch } = setup({ lastCheckedAt: "2026-10-15T11:00:00.000Z" });
    await service.run();
    expect(fetch).not.toHaveBeenCalled();
    await service.run(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("si la petición falla registra el error y no emite nada", async () => {
    const { service, emit, log } = setup({
      fetch: vi.fn(async () => {
        throw new Error("sin red");
      }),
    });
    await expect(service.run()).resolves.toEqual({ kind: "none" });
    expect(emit).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("sin red"));
  });
});
