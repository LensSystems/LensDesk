import { promises as fs } from "node:fs";
import path from "node:path";
import { TOOL_CATALOG_LIMITS, type ToolReleaseMetadata } from "../catalog/contract.ts";
import { parseToolReleaseMetadata } from "../catalog/parse.ts";
import { releaseSha256 } from "../publishing/artifacts.ts";
import { ToolReleaseError } from "../publishing/error.ts";
import { verifyPackage } from "../verify.ts";
import {
  CATALOG_BUILD_LIMITS,
  type CatalogRemoteAsset,
  type CatalogRemoteRelease,
  type ToolCatalogSource,
} from "./source.ts";

export type VerifiedCatalogPackage = { metadata: ToolReleaseMetadata; file: string };
export function catalogDownloader(source: ToolCatalogSource) {
  let total = 0;
  return async (asset: CatalogRemoteAsset, limit: number): Promise<Uint8Array> => {
    if (asset.size > limit || total + asset.size > CATALOG_BUILD_LIMITS.downloadedBytes)
      throw new ToolReleaseError("Catalog download budget exceeded");
    const bytes = await source.download(asset, limit);
    total += bytes.length;
    if (
      bytes.length !== asset.size ||
      bytes.length > limit ||
      total > CATALOG_BUILD_LIMITS.downloadedBytes
    )
      throw new ToolReleaseError("Downloaded catalog asset size does not match");
    return bytes;
  };
}
export type CatalogDownload = ReturnType<typeof catalogDownloader>;

export function releaseChecksumMap(bytes: Uint8Array): Map<string, string> {
  if (bytes.length > TOOL_CATALOG_LIMITS.metadataBytes)
    throw new ToolReleaseError("Checksum document exceeds limit");
  const entries = new Map<string, string>();
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  for (const line of text.trimEnd().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64}) {2}([^\\/#?%\r\n]+)$/.exec(line);
    if (!match?.[1] || !match[2] || match[0] !== line || entries.has(match[2]))
      throw new ToolReleaseError("Invalid or duplicate release checksum");
    entries.set(match[2], match[1]);
  }
  return entries;
}

export async function verifyCatalogPackage(options: {
  metadata: ToolReleaseMetadata;
  asset: CatalogRemoteAsset;
  bytes: Uint8Array;
  directory: string;
  publicKey: string;
}): Promise<VerifiedCatalogPackage> {
  const { metadata, asset, bytes } = options;
  if (
    metadata.asset.name !== asset.name ||
    metadata.asset.url !== asset.browser_download_url ||
    metadata.asset.size !== asset.size ||
    releaseSha256(bytes) !== metadata.asset.sha256
  )
    throw new ToolReleaseError("Package identity or hash conflicts with metadata");
  const file = path.join(options.directory, `${metadata.id}-${metadata.version}.lenspkg`);
  await fs.writeFile(file, bytes, { flag: "wx" });
  const result = await verifyPackage(file, { trustedKeys: { release: options.publicKey } });
  if (
    !result.ok ||
    !result.signed ||
    result.keyId !== "release" ||
    result.manifest.id !== metadata.id ||
    result.manifest.version !== metadata.version ||
    result.manifest.apiVersion !== metadata.apiVersion ||
    result.manifest.minHostVersion !== metadata.minHostVersion
  )
    throw new ToolReleaseError("Catalog package signature or manifest is invalid");
  return { metadata, file };
}

export async function independentCatalogPackage(options: {
  release: CatalogRemoteRelease;
  assets: CatalogRemoteAsset[];
  download: CatalogDownload;
  directory: string;
  publicKey: string;
}): Promise<VerifiedCatalogPackage> {
  const sidecar = options.assets.find((asset) => asset.name === "tool-release.json");
  const sumsAsset = options.assets.find((asset) => asset.name === "SHA256SUMS.txt");
  if (!sidecar || !sumsAsset || options.assets.length !== 3)
    throw new ToolReleaseError("Independent release is missing expected assets");
  const metadataBytes = await options.download(sidecar, TOOL_CATALOG_LIMITS.metadataBytes);
  const metadata = parseToolReleaseMetadata(metadataBytes);
  if (metadata.releaseTag !== options.release.tag_name)
    throw new ToolReleaseError("Metadata belongs to a different release");
  const sums = releaseChecksumMap(
    await options.download(sumsAsset, TOOL_CATALOG_LIMITS.metadataBytes),
  );
  const asset = options.assets.find((entry) => entry.name === metadata.asset.name);
  if (
    !asset ||
    sums.size !== 2 ||
    sums.get(sidecar.name) !== releaseSha256(metadataBytes) ||
    sums.get(asset.name) !== metadata.asset.sha256
  )
    throw new ToolReleaseError("Independent release checksums conflict");
  return verifyCatalogPackage({
    ...options,
    metadata,
    asset,
    bytes: await options.download(asset, TOOL_CATALOG_LIMITS.packageBytes),
  });
}
