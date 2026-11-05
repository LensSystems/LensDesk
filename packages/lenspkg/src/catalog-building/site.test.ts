import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFFICIAL_TOOLS_REPOSITORY } from "../catalog/contract.ts";
import { parseToolCatalog } from "../catalog/parse.ts";
import {
  CATALOG_SITE_INDEX,
  CATALOG_SITE_MARKER,
  CATALOG_SITE_MARKER_NAME,
  CATALOG_SITE_URL,
  preflightCatalogSite,
  writeCatalogSite,
} from "./site.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
const pages = { html_url: CATALOG_SITE_URL, build_type: "workflow", cname: null };
function mockSite(marker: string | null, index: string | null) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify(pages)))
    .mockResolvedValueOnce(new Response(marker, { status: marker === null ? 404 : 200 }))
    .mockResolvedValueOnce(new Response(index, { status: index === null ? 404 : 200 }));
}

describe("propiedad y despliegue seguro del sitio catálogo", () => {
  it("reconoce un sitio dedicado ya creado sin enviar token a Pages", async () => {
    const fetcher = mockSite(CATALOG_SITE_MARKER, CATALOG_SITE_INDEX);
    await expect(
      preflightCatalogSite({ token: "fixture-token", initialize: false, manual: false, fetcher }),
    ).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]?.[1]?.headers).toHaveProperty("Authorization");
    expect(fetcher.mock.calls[1]?.[1]?.headers).not.toHaveProperty("Authorization");
    expect(fetcher.mock.calls[2]?.[1]?.headers).not.toHaveProperty("Authorization");
  });

  it("solo inicializa Pages ya habilitado, vacío y con confirmación manual", async () => {
    await expect(
      preflightCatalogSite({
        token: "fixture",
        initialize: true,
        manual: true,
        fetcher: mockSite(null, null),
      }),
    ).resolves.toBeUndefined();
    for (const [initialize, manual] of [
      [false, false],
      [true, false],
      [false, true],
    ])
      await expect(
        preflightCatalogSite({
          token: "fixture",
          initialize: Boolean(initialize),
          manual: Boolean(manual),
          fetcher: mockSite(null, null),
        }),
      ).rejects.toThrow(/ownership/);
    const disabled = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("Not enabled", { status: 404 }));
    await expect(
      preflightCatalogSite({ token: "fixture", initialize: true, manual: true, fetcher: disabled }),
    ).rejects.toThrow();
    expect(disabled).toHaveBeenCalledOnce();
  });

  it("nunca reemplaza otra página o dominio aunque se solicite inicializar", async () => {
    for (const [marker, index] of [
      [null, "<h1>Otro sitio</h1>"],
      [CATALOG_SITE_MARKER, "Otro contenido"],
      ["bad marker", CATALOG_SITE_INDEX],
    ])
      await expect(
        preflightCatalogSite({
          token: "fixture",
          initialize: true,
          manual: true,
          fetcher: mockSite(marker ?? null, index ?? null),
        }),
      ).rejects.toThrow();
    const wrongUrl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...pages, html_url: "https://other.test/" })),
      );
    await expect(
      preflightCatalogSite({
        token: "fixture",
        initialize: false,
        manual: false,
        fetcher: wrongUrl,
      }),
    ).rejects.toThrow(/configured/);
    expect(wrongUrl).toHaveBeenCalledOnce();
  });

  it("no escribe mediante un índice enlazado a otro archivo local", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lensdesk-site-link-"));
    roots.push(root);
    const directory = path.join(root, "site");
    await fs.mkdir(directory);
    const outside = path.join(root, "outside.html");
    await fs.writeFile(outside, CATALOG_SITE_INDEX);
    await fs.symlink(outside, path.join(directory, "index.html"), "file");
    const catalog = parseToolCatalog(
      JSON.stringify({
        schemaVersion: 1,
        repository: OFFICIAL_TOOLS_REPOSITORY,
        generatedAt: "2026-11-04T12:00:00.000Z",
        releases: [],
      }),
    );
    await expect(writeCatalogSite(catalog, directory)).rejects.toThrow(/symlink/);
    expect(await fs.readFile(outside, "utf8")).toBe(CATALOG_SITE_INDEX);
  });

  it("solo exporta catálogo validado y deja el último índice si falla validación", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "lensdesk-site-test-"));
    roots.push(root);
    const catalog = parseToolCatalog(
      JSON.stringify({
        schemaVersion: 1,
        repository: OFFICIAL_TOOLS_REPOSITORY,
        generatedAt: "2026-11-04T12:00:00.000Z",
        releases: [],
      }),
    );
    await writeCatalogSite(catalog, root);
    const original = await fs.readFile(path.join(root, "tools-catalog-v1.json"));
    await expect(
      writeCatalogSite({ ...catalog, repository: "Other/Repo" } as unknown as typeof catalog, root),
    ).rejects.toThrow();
    expect(await fs.readFile(path.join(root, "tools-catalog-v1.json"))).toEqual(original);
    expect((await fs.readdir(root)).sort()).toEqual(
      ["index.html", CATALOG_SITE_MARKER_NAME, "tools-catalog-v1.json"].sort(),
    );
    await fs.writeFile(path.join(root, "unrelated.html"), "existing");
    await expect(writeCatalogSite(catalog, root)).rejects.toThrow(/unrelated/);
  });
});
