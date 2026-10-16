import { describe, expect, it, vi } from "vitest";
import { checkForUpdate, type UpdateFetch } from "./check.ts";

const now = () => new Date("2026-10-15T12:00:00.000Z");
const release = (body: unknown, ok = true, status = 200): UpdateFetch =>
  vi.fn(async () => ({ ok, status, json: async () => body }));
const base = {
  repo: "lensdesk/lensdesk",
  enabled: true,
  lastCheckedAt: null,
  now,
  currentVersion: "0.1.0",
};

describe("checkForUpdate", () => {
  it("no llama a fetch con el repositorio vacío", async () => {
    const fetch = release({ tag_name: "v9.0.0", html_url: "https://github.com/a/b" });
    await expect(checkForUpdate({ ...base, repo: "", fetch })).resolves.toEqual({
      kind: "skipped",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("no llama a fetch con la comprobación desactivada", async () => {
    const fetch = release({ tag_name: "v9.0.0", html_url: "https://github.com/a/b" });
    await expect(checkForUpdate({ ...base, enabled: false, fetch })).resolves.toEqual({
      kind: "skipped",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("no llama a fetch si la última comprobación fue hace menos de 24 h", async () => {
    const fetch = release({ tag_name: "v9.0.0", html_url: "https://github.com/a/b" });
    const result = await checkForUpdate({
      ...base,
      lastCheckedAt: "2026-10-14T12:00:01.000Z",
      fetch,
    });
    expect(result).toEqual({ kind: "skipped" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("no llama a fetch con un repositorio mal formado", async () => {
    const fetch = release({});
    const log = vi.fn();
    await expect(checkForUpdate({ ...base, repo: "../evil", fetch, log })).resolves.toEqual({
      kind: "skipped",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it("hace un único GET a releases/latest pasadas 24 h y avisa de una versión mayor", async () => {
    const fetch = release({
      tag_name: "v0.2.0",
      html_url: "https://github.com/o/r/releases/v0.2.0",
    });
    const result = await checkForUpdate({
      ...base,
      repo: "o/r",
      lastCheckedAt: "2026-10-14T11:59:59.000Z",
      fetch,
    });
    expect(result).toEqual({
      kind: "available",
      version: "0.2.0",
      url: "https://github.com/o/r/releases/v0.2.0",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/o/r/releases/latest",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("devuelve none si la versión publicada no es mayor", async () => {
    for (const tag of ["v0.1.0", "0.0.9"]) {
      const fetch = release({ tag_name: tag, html_url: "https://github.com/o/r" });
      await expect(checkForUpdate({ ...base, fetch })).resolves.toEqual({ kind: "none" });
    }
  });

  it("registra y devuelve none cuando la petición falla", async () => {
    const cases: UpdateFetch[] = [
      vi.fn(async () => {
        throw new Error("sin red");
      }),
      release({}, false, 503),
      release({ tag_name: "v1.0.0" }),
      release({ tag_name: "v1.0.0", html_url: "http://github.com/o/r" }),
      release({ tag_name: "latest", html_url: "https://github.com/o/r" }),
    ];
    for (const fetch of cases) {
      const log = vi.fn();
      await expect(checkForUpdate({ ...base, fetch, log })).resolves.toEqual({ kind: "none" });
      expect(log).toHaveBeenCalledTimes(1);
    }
  });
});
