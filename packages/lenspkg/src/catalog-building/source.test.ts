import { describe, expect, it, vi } from "vitest";
import {
  allCatalogAssets,
  allCatalogReleases,
  CATALOG_BUILD_LIMITS,
  type CatalogRemoteAsset,
  type ToolCatalogSource,
} from "./source.ts";
import { catalogDownloader } from "./verify.ts";

const source = (): ToolCatalogSource => ({
  releases: vi.fn().mockResolvedValue([]),
  assets: vi.fn().mockResolvedValue([]),
  download: vi.fn().mockResolvedValue(new Uint8Array()),
});

describe("enumeración y límites del catálogo", () => {
  it("no trunca una enumeración de releases o assets que exceda páginas", async () => {
    const many = source();
    vi.mocked(many.releases).mockImplementation(async (page) =>
      Array.from({ length: 100 }, (_, i) => ({
        id: page * 100 + i + 1,
        tag_name: `ignored-${page}-${i}`,
        draft: false,
        prerelease: false,
      })),
    );
    await expect(allCatalogReleases(many)).rejects.toThrow(/page limit/);
    expect(many.releases).toHaveBeenCalledTimes(CATALOG_BUILD_LIMITS.releasePages);
    const release = { id: 1, tag_name: "v0.4.0", draft: false, prerelease: false };
    vi.mocked(many.assets).mockImplementation(async (_id, page) =>
      Array.from({ length: 100 }, (_, i) => {
        const name = `file-${page}-${i}.txt`;
        return {
          id: page * 100 + i + 1,
          name,
          size: 1,
          state: "uploaded",
          browser_download_url: `https://github.com/LensSystems/LensDesk/releases/download/v0.4.0/${name}`,
        };
      }),
    );
    await expect(allCatalogAssets(many, release)).rejects.toThrow(/page limit/);
    expect(many.assets).toHaveBeenCalledTimes(CATALOG_BUILD_LIMITS.assetPages);
  });

  it("rechaza nombres repetidos, escapes o URLs de otro repositorio", async () => {
    const release = { id: 1, tag_name: "v0.4.0", draft: false, prerelease: false };
    const asset: CatalogRemoteAsset = {
      id: 1,
      name: "tool.lenspkg",
      size: 1,
      state: "uploaded",
      browser_download_url:
        "https://github.com/LensSystems/LensDesk/releases/download/v0.4.0/tool.lenspkg",
    };
    for (const assets of [
      [asset, asset],
      [{ ...asset, name: "../tool.lenspkg" }],
      [{ ...asset, browser_download_url: "https://github.com/Other/Repo/file" }],
    ]) {
      const f = source();
      vi.mocked(f.assets).mockResolvedValue(assets);
      await expect(allCatalogAssets(f, release)).rejects.toThrow();
    }
  });

  it("limita bytes acumulados antes de descargar otro paquete y comprueba tamaño real", async () => {
    const bytes = new Uint8Array(8 * 1024 * 1024);
    const f = source();
    vi.mocked(f.download).mockResolvedValue(bytes);
    const asset: CatalogRemoteAsset = {
      id: 1,
      name: "tool.lenspkg",
      size: bytes.length,
      state: "uploaded",
      browser_download_url:
        "https://github.com/LensSystems/LensDesk/releases/download/v0.4.0/tool.lenspkg",
    };
    const download = catalogDownloader(f);
    const allowed = CATALOG_BUILD_LIMITS.downloadedBytes / bytes.length;
    for (let i = 0; i < allowed; i++) await download(asset, bytes.length);
    await expect(download(asset, bytes.length)).rejects.toThrow(/budget/);
    expect(f.download).toHaveBeenCalledTimes(allowed);
    const wrong = source();
    vi.mocked(wrong.download).mockResolvedValue(new Uint8Array(2));
    await expect(catalogDownloader(wrong)({ ...asset, size: 1 }, 1)).rejects.toThrow(/size/);
  });
});
