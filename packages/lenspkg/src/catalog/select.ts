import { SUPPORTED_API_VERSIONS } from "@lensdesk/sdk";
import semver from "semver";
import type { ToolCatalog, ToolReleaseMetadata } from "./contract.ts";
import { ToolCatalogValidationError } from "./parse.ts";

export type InstalledCatalogTool = { id: string; version: string };
export type IncompatibleToolRelease = {
  release: ToolReleaseMetadata;
  reasons: ("apiVersion" | "minHostVersion")[];
};
export type ToolCatalogSelection = {
  updates: ToolReleaseMetadata[];
  incompatible: IncompatibleToolRelease[];
};

function normalizeVersion(value: string): string {
  const normalized = typeof value === "string" ? semver.valid(value) : null;
  if (normalized === null)
    throw new ToolCatalogValidationError("Invalid installed or host version");
  return normalized;
}

export function selectToolCatalogUpdates(
  catalog: ToolCatalog,
  installed: readonly InstalledCatalogTool[],
  hostVersion: string,
): ToolCatalogSelection {
  const normalizedHost = normalizeVersion(hostVersion);
  const seen = new Set<string>();
  const result: ToolCatalogSelection = { updates: [], incompatible: [] };
  for (const tool of installed) {
    if (typeof tool.id !== "string" || !/^[a-z][a-z0-9-]{1,39}$/.test(tool.id) || seen.has(tool.id))
      throw new ToolCatalogValidationError("Invalid or duplicate installed tool ID");
    seen.add(tool.id);
    const installedVersion = normalizeVersion(tool.version);
    let compatible: ToolReleaseMetadata | undefined;
    let incompatible: IncompatibleToolRelease | undefined;
    for (const release of catalog.releases) {
      if (release.id !== tool.id || !semver.gt(release.version, installedVersion)) continue;
      const reasons: IncompatibleToolRelease["reasons"] = [];
      if (!(SUPPORTED_API_VERSIONS as readonly number[]).includes(release.apiVersion))
        reasons.push("apiVersion");
      if (semver.gt(release.minHostVersion, normalizedHost)) reasons.push("minHostVersion");
      if (reasons.length) {
        if (!incompatible || semver.gt(release.version, incompatible.release.version))
          incompatible = { release, reasons };
      } else if (!compatible || semver.gt(release.version, compatible.version)) {
        compatible = release;
      }
    }
    if (compatible) result.updates.push(compatible);
    if (
      incompatible &&
      semver.gt(incompatible.release.version, compatible?.version ?? installedVersion)
    )
      result.incompatible.push(incompatible);
  }
  return result;
}
