import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { TOOL_CATALOG_LIMITS } from "../catalog/contract.ts";
import { ToolReleaseError } from "../publishing/error.ts";
import { type BootstrapManifest, bootstrapManifestSchema } from "./bootstrap.ts";
import type { CatalogRemoteAsset, CatalogRemoteRelease, ToolCatalogSource } from "./source.ts";

export type OfflineCatalogFixture = {
  publicKey: string;
  bootstrapManifest: BootstrapManifest;
  releases: CatalogRemoteRelease[][];
  assets: Record<string, CatalogRemoteAsset[][]>;
  files: Record<string, string>;
};

export async function readOfflineCatalogFixture(
  file: string,
): Promise<{ publicKey: string; bootstrapManifest: BootstrapManifest; source: ToolCatalogSource }> {
  if ((await fs.stat(file)).size > 2 * 1024 * 1024)
    throw new ToolReleaseError("Offline fixture exceeds limit");
  const fixture = z
    .object({
      publicKey: z.string().max(4096),
      bootstrapManifest: bootstrapManifestSchema,
      releases: z.array(z.array(z.unknown()).max(100)).max(100),
      assets: z.record(z.string(), z.array(z.array(z.unknown()).max(100)).max(10)),
      files: z.record(z.string(), z.string().min(1).max(256)),
    })
    .parse(JSON.parse(await fs.readFile(file, "utf8"))) as OfflineCatalogFixture;
  const base = await fs.realpath(path.dirname(file));
  return {
    publicKey: fixture.publicKey,
    bootstrapManifest: fixture.bootstrapManifest,
    source: {
      async releases(page) {
        return fixture.releases[page - 1] ?? [];
      },
      async assets(id, page) {
        return fixture.assets[String(id)]?.[page - 1] ?? [];
      },
      async download(asset, limit) {
        const relative = fixture.files[String(asset.id)];
        if (!relative || !/^[a-zA-Z0-9_./-]+$/.test(relative))
          throw new ToolReleaseError("Offline asset path is invalid");
        const target = path.resolve(base, relative);
        if (
          !target.startsWith(`${base}${path.sep}`) ||
          (await fs.realpath(target)) !== target ||
          (await fs.stat(target)).size > Math.min(limit, TOOL_CATALOG_LIMITS.packageBytes)
        )
          throw new ToolReleaseError("Offline asset escapes fixture or exceeds limit");
        return fs.readFile(target);
      },
    },
  };
}
