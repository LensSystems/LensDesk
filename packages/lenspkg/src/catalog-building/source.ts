import { z } from "zod";
import { OFFICIAL_TOOLS_REPOSITORY, TOOL_CATALOG_LIMITS } from "../catalog/contract.ts";
import { ToolReleaseError } from "../publishing/error.ts";
import { createGitHubReleaseHttp } from "../publishing/github-http.ts";

export const CATALOG_BUILD_LIMITS = Object.freeze({
  releasePages: 100,
  assetPages: 10,
  pageEntries: 100,
  downloadedBytes: 2 * 1024 * 1024 * 1024,
});
const remoteId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const releaseSchema = z.object({
  id: remoteId,
  tag_name: z.string().max(256),
  draft: z.boolean(),
  prerelease: z.boolean(),
});
const assetSchema = z.object({
  id: remoteId,
  name: z.string().min(1).max(256),
  size: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  state: z.literal("uploaded"),
  browser_download_url: z.string().max(512),
});
export type CatalogRemoteRelease = z.infer<typeof releaseSchema>;
export type CatalogRemoteAsset = z.infer<typeof assetSchema>;
export type ToolCatalogSource = {
  releases(page: number): Promise<CatalogRemoteRelease[]>;
  assets(releaseId: number, page: number): Promise<CatalogRemoteAsset[]>;
  download(asset: CatalogRemoteAsset, maximumBytes: number): Promise<Uint8Array>;
};

export function createGitHubCatalogSource(
  token: string,
  fetcher: typeof fetch = fetch,
): ToolCatalogSource {
  const http = createGitHubReleaseHttp(token, fetcher);
  const root = `/repos/${OFFICIAL_TOOLS_REPOSITORY}`;
  return {
    async releases(page) {
      if (!Number.isInteger(page) || page < 1 || page > CATALOG_BUILD_LIMITS.releasePages)
        throw new ToolReleaseError("Invalid release page");
      return z
        .array(releaseSchema)
        .max(100)
        .parse(await http.json("GET", `${root}/releases?per_page=100&page=${page}`));
    },
    async assets(id, page) {
      if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        !Number.isInteger(page) ||
        page < 1 ||
        page > CATALOG_BUILD_LIMITS.assetPages
      )
        throw new ToolReleaseError("Invalid asset page");
      return z
        .array(assetSchema)
        .max(100)
        .parse(await http.json("GET", `${root}/releases/${id}/assets?per_page=100&page=${page}`));
    },
    download(asset, maximumBytes) {
      if (asset.size > maximumBytes || maximumBytes > TOOL_CATALOG_LIMITS.packageBytes)
        throw new ToolReleaseError("Catalog source asset exceeds size limit");
      return http.downloadAsset(asset.id, maximumBytes);
    },
  };
}

export async function allCatalogReleases(
  source: ToolCatalogSource,
): Promise<CatalogRemoteRelease[]> {
  const releases: CatalogRemoteRelease[] = [];
  const ids = new Set<number>();
  const tags = new Set<string>();
  for (let page = 1; page <= CATALOG_BUILD_LIMITS.releasePages; page++) {
    const entries = z
      .array(releaseSchema)
      .max(100)
      .parse(await source.releases(page));
    for (const release of entries) {
      if (ids.has(release.id) || tags.has(release.tag_name))
        throw new ToolReleaseError("Release enumeration repeated an ID or tag");
      ids.add(release.id);
      tags.add(release.tag_name);
      releases.push(release);
    }
    if (entries.length < 100) return releases;
  }
  throw new ToolReleaseError("Release enumeration exceeds page limit");
}

export async function allCatalogAssets(
  source: ToolCatalogSource,
  release: CatalogRemoteRelease,
): Promise<CatalogRemoteAsset[]> {
  const assets: CatalogRemoteAsset[] = [];
  const ids = new Set<number>();
  const names = new Set<string>();
  for (let page = 1; page <= CATALOG_BUILD_LIMITS.assetPages; page++) {
    const entries = z
      .array(assetSchema)
      .max(100)
      .parse(await source.assets(release.id, page));
    for (const asset of entries) {
      const expected = `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases/download/${release.tag_name}/${asset.name}`;
      if (
        ids.has(asset.id) ||
        names.has(asset.name) ||
        asset.browser_download_url !== expected ||
        /[\\/#?%\r\n]/.test(asset.name)
      )
        throw new ToolReleaseError("Duplicate asset or unexpected download URL");
      ids.add(asset.id);
      names.add(asset.name);
      assets.push(asset);
    }
    if (entries.length < 100) return assets;
  }
  throw new ToolReleaseError("Asset enumeration exceeds page limit");
}
