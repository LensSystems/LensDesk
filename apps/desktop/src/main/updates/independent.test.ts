import { OFFICIAL_TOOLS_CATALOG_URL } from "@lensdesk/lenspkg";
import { describe, expect, it } from "vitest";
import { appResponse, catalogRelease, catalogResponse, updateFixture } from "./test-fixtures.ts";

const appUrl = "https://api.github.com/repos/LensSystems/LensDesk/releases/latest";
describe("fuentes de app y catálogo independientes", () => {
  it("elige compatible intermedia e informa la posterior incompatible, sin buscar por herramienta", async () => {
    const f = updateFixture();
    f.state.catalog = () =>
      catalogResponse([
        catalogRelease(),
        catalogRelease("notes", "0.6.0", "0.6.0"),
        catalogRelease("notes", "0.7.0", "0.6.0", 2),
        catalogRelease("not-installed", "1.0.0"),
      ]);
    const result = await f.service.run(true);
    expect(result).toMatchObject({
      kind: "none",
      tools: [{ id: "notes", version: "0.4.5" }],
      incompatible: [{ id: "notes", version: "0.7.0", reasons: ["apiVersion", "minHostVersion"] }],
      sources: { app: { status: "success", update: null }, tools: { status: "success" } },
    });
    expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([appUrl, OFFICIAL_TOOLS_CATALOG_URL]);
    for (const [url, init] of f.fetch.mock.calls) {
      expect(new URL(url).search).toBe("");
      expect(init).toMatchObject({ method: "GET", redirect: "error", credentials: "omit" });
      expect(init).not.toHaveProperty("body");
      expect(JSON.stringify(init)).not.toContain("notes");
    }
  });
  it("catálogo fallido no usa los paquetes de Latest como fallback", async () => {
    const f = updateFixture();
    f.state.app = () =>
      Response.json({
        tag_name: "v0.4.0",
        html_url: "https://github.com/LensSystems/LensDesk/releases/tag/v0.4.0",
        assets: [
          {
            name: "notes-9.0.0.lenspkg",
            browser_download_url:
              "https://github.com/LensSystems/LensDesk/releases/download/v0.4.0/notes-9.0.0.lenspkg",
          },
        ],
      });
    f.state.catalog = () => new Response("limited", { status: 429 });
    expect(await f.service.run(true)).toMatchObject({
      tools: [],
      sources: { app: { status: "success" }, tools: { status: "error", updates: [] } },
    });
    expect(f.emitTools).toHaveBeenLastCalledWith({ tools: [], incompatible: [], status: "error" });
  });
  it("el cache conserva candidatas de herramientas todavía no instaladas", async () => {
    const f = updateFixture();
    f.state.catalog = () => catalogResponse([catalogRelease(), catalogRelease("viewer", "1.0.0")]);
    await f.service.run(true);
    f.state.installed.push({ id: "viewer", version: "0.1.0" });
    expect(f.service.reconcile().tools.updates).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "viewer", version: "1.0.0" })]),
    );
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
  it("descubre una nueva oficial instalada sin nueva versión de app", async () => {
    const f = updateFixture();
    f.state.installed = [{ id: "viewer", version: "0.1.0" }];
    f.state.catalog = () => catalogResponse([catalogRelease("viewer", "1.0.0")]);
    expect(await f.service.run()).toMatchObject({
      kind: "none",
      tools: [{ id: "viewer", version: "1.0.0" }],
    });
    expect(f.emit).not.toHaveBeenCalled();
  });
  it("fallos parciales conservan datos anteriores marcados como error y la recuperación limpia solo su fuente", async () => {
    const f = updateFixture();
    f.state.app = () => appResponse("0.5.0");
    await f.service.run(true);
    f.state.app = () => new Response("offline", { status: 503 });
    f.state.catalog = () => catalogResponse([]);
    expect(await f.service.run(true)).toMatchObject({
      kind: "error",
      tools: [],
      sources: {
        app: { status: "error", update: { version: "0.5.0" } },
        tools: { status: "success", updates: [] },
      },
    });
    f.state.app = () => appResponse();
    f.state.catalog = () => catalogResponse();
    await f.service.run(true);
    f.state.catalog = () => {
      throw Error("offline");
    };
    const result = await f.service.run(true);
    expect(result).toMatchObject({
      kind: "none",
      tools: [{ id: "notes", version: "0.4.5" }],
      sources: { app: { status: "success", update: null }, tools: { status: "error" } },
    });
    expect(f.emitChecked).toHaveBeenLastCalledWith({ sources: result.sources });
    f.state.app = () => {
      throw Error("offline");
    };
    expect(await f.service.run(true)).toMatchObject({
      kind: "error",
      sources: {
        app: { status: "error" },
        tools: { status: "error", updates: [{ id: "notes", version: "0.4.5" }] },
      },
    });
    f.state.app = () => appResponse();
    f.state.catalog = () => catalogResponse([]);
    expect(await f.service.run(true)).toMatchObject({
      kind: "none",
      tools: [],
      sources: {
        app: { status: "success", update: null },
        tools: { status: "success", updates: [] },
      },
    });
  });
  it("app none automática y manual emite estado autoritativo que limpia un aviso anterior", async () => {
    for (const force of [false, true]) {
      const f = updateFixture();
      f.state.app = () => appResponse("0.5.0");
      await f.service.run(true);
      f.state.app = () => appResponse();
      f.state.lastCheckedAt = null;
      await f.service.run(force);
      expect(f.emit).toHaveBeenCalledTimes(1);
      expect(f.emitChecked).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sources: expect.objectContaining({ app: { status: "success", update: null } }),
        }),
      );
    }
  });
  it("reconcilia instalación/remoción desde el catálogo completo RAM sin ninguna GET", async () => {
    const f = updateFixture();
    await f.service.run(true);
    expect(f.service.reconcile().tools.updates).toHaveLength(1);
    f.state.installed[0] = { id: "notes", version: "0.4.5" };
    expect(f.service.reconcile().tools.updates).toEqual([]);
    f.state.installed = [];
    expect(f.service.reconcile().tools.updates).toEqual([]);
    f.state.installed = [{ id: "notes", version: "v0.4.0+local" }];
    expect(f.service.reconcile().tools.updates).toHaveLength(1);
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
  it("resuelve con versiones instaladas actuales después de recibir la respuesta", async () => {
    const f = updateFixture();
    let complete = () => {};
    f.state.catalog = () =>
      new Promise<Response>((resolve) => {
        complete = () => resolve(catalogResponse());
      });
    const running = f.service.run(true);
    f.state.installed = [{ id: "notes", version: "0.4.5" }];
    complete();
    expect(await running).toMatchObject({ tools: [], sources: { tools: { status: "success" } } });
  });
  it("double click y manual/auto reales comparten exactamente dos GETs", async () => {
    const f = updateFixture();
    const first = f.service.run(true);
    expect(f.service.run()).toBe(first);
    expect(f.service.run(true)).toBe(first);
    await first;
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
  it("un manual inmediato no hereda el skipped automático dentro del intervalo", async () => {
    const f = updateFixture();
    f.state.lastCheckedAt = "2026-11-04T11:00:00.000Z";
    const automatic = f.service.run();
    const manual = f.service.run(true);
    expect(manual).not.toBe(automatic);
    expect(await automatic).toMatchObject({
      kind: "skipped",
      sources: { app: { status: "not-checked" }, tools: { status: "not-checked" } },
    });
    expect(await manual).toMatchObject({ kind: "none" });
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["", "../bad", "owner/..", "https://evil.test/repo", "owner/repo?x"])(
    "repo %s no permite GET ni forzando",
    async (repo) => {
      const f = updateFixture(repo);
      expect(await f.service.run(true)).toMatchObject({ kind: "skipped" });
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );
  it("disabled no consulta ni con force y otro repo no mezcla catálogo oficial", async () => {
    const disabled = updateFixture();
    disabled.state.enabled = false;
    expect(await disabled.service.run(true)).toMatchObject({ kind: "skipped" });
    expect(disabled.fetch).not.toHaveBeenCalled();
    const other = updateFixture("other/repo");
    other.state.app = () =>
      Response.json({
        tag_name: "v0.5.0",
        html_url: "https://github.com/other/repo/releases/tag/v0.5.0",
      });
    expect(await other.service.run(true)).toMatchObject({
      kind: "available",
      sources: { app: { status: "success" }, tools: { status: "not-checked", updates: [] } },
    });
    expect(other.fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://api.github.com/repos/other/repo/releases/latest",
    ]);
  });
});
