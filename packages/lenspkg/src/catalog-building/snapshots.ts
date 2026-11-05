import { constants, promises as fs } from "node:fs";
import path from "node:path";
import semver from "semver";
import type { ToolCatalog, ToolReleaseMetadata } from "../catalog/contract.ts";
import { releaseSha256 } from "../publishing/artifacts.ts";
import { ToolReleaseError } from "../publishing/error.ts";
import type { BuiltToolCatalog } from "./build.ts";

export const LEGACY_SNAPSHOT_HOST = "0.4.0";
export const LEGACY_SNAPSHOT_API = 1;

export function selectLegacySnapshots(catalog: ToolCatalog): ToolReleaseMetadata[] {
  const selected = new Map<string, ToolReleaseMetadata>();
  for (const candidate of catalog.releases) {
    if (
      candidate.apiVersion !== LEGACY_SNAPSHOT_API ||
      semver.gt(candidate.minHostVersion, LEGACY_SNAPSHOT_HOST)
    )
      continue;
    const previous = selected.get(candidate.id);
    if (!previous || semver.gt(candidate.version, previous.version))
      selected.set(candidate.id, candidate);
  }
  return [...selected.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export async function copyLegacySnapshots(
  built: BuiltToolCatalog,
  output: string,
): Promise<string[]> {
  const selected = selectLegacySnapshots(built.catalog);
  const prepared: { name: string; file: string; hash: string; existing: boolean }[] = [];
  await fs.mkdir(output, { recursive: true });
  const allowed = new Set(selected.map((entry) => entry.asset.name));
  if ((await fs.readdir(output)).some((name) => /\.lenspkg$/i.test(name) && !allowed.has(name)))
    throw new ToolReleaseError("Output contains a package outside the legacy snapshot selection");
  for (const metadata of selected) {
    const candidate = built.packages.find(
      (entry) => entry.metadata.id === metadata.id && entry.metadata.version === metadata.version,
    );
    if (
      !candidate ||
      (await fs.lstat(candidate.file)).isSymbolicLink() ||
      (await fs.stat(candidate.file)).size !== metadata.asset.size
    )
      throw new ToolReleaseError("Verified snapshot package is missing");
    if (releaseSha256(await fs.readFile(candidate.file)) !== metadata.asset.sha256)
      throw new ToolReleaseError("Cached snapshot bytes changed");
    let existing = false;
    try {
      const destination = path.join(output, metadata.asset.name);
      if (
        (await fs.lstat(destination)).isSymbolicLink() ||
        (await fs.stat(destination)).size !== metadata.asset.size ||
        releaseSha256(await fs.readFile(destination)) !== metadata.asset.sha256
      )
        throw new ToolReleaseError("Existing snapshot bytes conflict");
      existing = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    prepared.push({
      name: metadata.asset.name,
      file: candidate.file,
      hash: metadata.asset.sha256,
      existing,
    });
  }
  for (const item of prepared) {
    const destination = path.join(output, item.name);
    if (!item.existing) await fs.copyFile(item.file, destination, constants.COPYFILE_EXCL);
    if (releaseSha256(await fs.readFile(destination)) !== item.hash)
      throw new ToolReleaseError("Copied snapshot bytes changed");
  }
  return prepared.map((entry) => entry.name);
}
