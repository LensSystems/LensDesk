import { promises as fs } from "node:fs";
import path from "node:path";
import {
  OFFICIAL_TOOLS_REPOSITORY,
  TOOL_CATALOG_LIMITS,
  type ToolCatalog,
  toolReleaseMetadataSchema,
} from "../catalog/contract.ts";
import { parseToolCatalog } from "../catalog/parse.ts";
import { releaseSha256 } from "../publishing/artifacts.ts";
import { ToolReleaseError } from "../publishing/error.ts";
import { parseToolReleaseTag } from "../publishing/source.ts";
import { verifyPackage } from "../verify.ts";
import {
  type BootstrapManifest,
  bootstrapManifestSchema,
  ORIGINAL_BOOTSTRAP_MANIFEST,
} from "./bootstrap.ts";
import {
  allCatalogAssets,
  allCatalogReleases,
  type CatalogRemoteAsset,
  type CatalogRemoteRelease,
  type ToolCatalogSource,
} from "./source.ts";
import { assertCatalogTriggerPresent } from "./trigger.ts";
import {
  type CatalogDownload,
  catalogDownloader,
  independentCatalogPackage,
  releaseChecksumMap,
  type VerifiedCatalogPackage,
  verifyCatalogPackage,
} from "./verify.ts";

export type BuiltToolCatalog = { catalog: ToolCatalog; packages: VerifiedCatalogPackage[] };

async function bootstrapPackages(
  release: CatalogRemoteRelease,
  assets: CatalogRemoteAsset[],
  download: CatalogDownload,
  directory: string,
  publicKey: string,
  manifest: BootstrapManifest,
): Promise<VerifiedCatalogPackage[]> {
  const sumsAsset = assets.find((asset) => asset.name === "SHA256SUMS.txt");
  if (!sumsAsset) throw new ToolReleaseError("Bootstrap release is missing checksums");
  const sums = releaseChecksumMap(await download(sumsAsset, TOOL_CATALOG_LIMITS.metadataBytes));
  const packages: VerifiedCatalogPackage[] = [];
  for (const anchor of manifest) {
    const { id, name } = anchor;
    const asset = assets.find((entry) => entry.name === name);
    if (!asset || !sums.has(name)) throw new ToolReleaseError("Bootstrap package is missing");
    if (
      asset.browser_download_url !== anchor.url ||
      asset.size !== anchor.size ||
      sums.get(name) !== anchor.sha256
    )
      throw new ToolReleaseError("Bootstrap checksum or immutable anchor mismatch");
    const bytes = await download(asset, TOOL_CATALOG_LIMITS.packageBytes);
    if (releaseSha256(bytes) !== anchor.sha256)
      throw new ToolReleaseError("Bootstrap checksum mismatch");
    const temporary = path.join(directory, `bootstrap-${id}.lenspkg`);
    await fs.writeFile(temporary, bytes, { flag: "wx" });
    const verified = await verifyPackage(temporary, { trustedKeys: { release: publicKey } });
    if (!verified.ok || !verified.signed || verified.keyId !== "release")
      throw new ToolReleaseError("Bootstrap signature is invalid");
    const manifest = verified.manifest;
    const metadata = toolReleaseMetadataSchema.parse({
      schemaVersion: 1,
      repository: OFFICIAL_TOOLS_REPOSITORY,
      id: manifest.id,
      version: manifest.version,
      apiVersion: manifest.apiVersion,
      minHostVersion: manifest.minHostVersion,
      releaseTag: release.tag_name,
      asset: { name, url: asset.browser_download_url, size: bytes.length, sha256: anchor.sha256 },
      notesUrl: `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases/tag/${release.tag_name}`,
    });
    if (metadata.id !== id) throw new ToolReleaseError("Bootstrap tool identity mismatch");
    packages.push(await verifyCatalogPackage({ metadata, asset, bytes, directory, publicKey }));
    await fs.unlink(temporary);
  }
  return packages;
}

export async function buildToolCatalog(options: {
  source: ToolCatalogSource;
  publicKey: string;
  directory: string;
  now: () => Date;
  /** Explicit fixture anchors only; production CLI never accepts an override. */
  bootstrapManifest?: BootstrapManifest;
  /** Tag derived from the validated caller context for post-publication builds. */
  expectedReleaseTag?: string;
}): Promise<BuiltToolCatalog> {
  await fs.mkdir(options.directory, { recursive: true });
  if ((await fs.readdir(options.directory)).length)
    throw new ToolReleaseError("Catalog work directory must be empty");
  const releases = await allCatalogReleases(options.source);
  const triggerKind = assertCatalogTriggerPresent(releases, options.expectedReleaseTag);
  const bootstrap = releases.find(
    (release) => release.tag_name === "v0.4.0" && !release.draft && !release.prerelease,
  );
  if (!bootstrap) throw new ToolReleaseError("Published bootstrap release v0.4.0 is required");
  const download = catalogDownloader(options.source);
  const packages = await bootstrapPackages(
    bootstrap,
    await allCatalogAssets(options.source, bootstrap),
    download,
    options.directory,
    options.publicKey,
    bootstrapManifestSchema.parse(options.bootstrapManifest ?? ORIGINAL_BOOTSTRAP_MANIFEST),
  );
  const versions = new Map(packages.map((entry) => [entry.metadata.id, 1]));
  for (const release of releases) {
    if (release.draft || release.prerelease || !/^[a-z][a-z0-9-]{1,39}-v/.test(release.tag_name))
      continue;
    const identity = parseToolReleaseTag(release.tag_name);
    const count = (versions.get(identity.id) ?? 0) + 1;
    versions.set(identity.id, count);
    if (count > TOOL_CATALOG_LIMITS.versionsPerTool || versions.size > TOOL_CATALOG_LIMITS.tools)
      throw new ToolReleaseError("Catalog tool or version limit exceeded");
    if (packages.length >= TOOL_CATALOG_LIMITS.entries)
      throw new ToolReleaseError("Catalog candidate limit exceeded");
    packages.push(
      await independentCatalogPackage({
        release,
        assets: await allCatalogAssets(options.source, release),
        download,
        directory: options.directory,
        publicKey: options.publicKey,
      }),
    );
  }
  packages.sort((a, b) =>
    a.metadata.id < b.metadata.id
      ? -1
      : a.metadata.id > b.metadata.id
        ? 1
        : a.metadata.version < b.metadata.version
          ? -1
          : a.metadata.version > b.metadata.version
            ? 1
            : 0,
  );
  const catalog = parseToolCatalog(
    JSON.stringify({
      schemaVersion: 1,
      repository: OFFICIAL_TOOLS_REPOSITORY,
      generatedAt: options.now().toISOString(),
      releases: packages.map((entry) => entry.metadata),
    }),
  );
  if (
    triggerKind === "tool" &&
    !catalog.releases.some((release) => release.releaseTag === options.expectedReleaseTag)
  )
    throw new ToolReleaseError("Triggering tool release metadata must be included in catalog");
  return { catalog, packages };
}
