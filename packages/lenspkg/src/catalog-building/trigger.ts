import semver from "semver";
import { ToolReleaseError } from "../publishing/error.ts";
import { parseToolReleaseTag } from "../publishing/source.ts";
import type { CatalogRemoteRelease } from "./source.ts";

export function catalogReleaseKind(tag: string): "app" | "tool" {
  const version = tag.startsWith("v") ? tag.slice(1) : "";
  if (
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version) &&
    semver.valid(version) === version
  )
    return "app";
  parseToolReleaseTag(tag);
  return "tool";
}

export function assertCatalogTriggerPresent(
  releases: CatalogRemoteRelease[],
  expectedReleaseTag: string | undefined,
): "app" | "tool" | undefined {
  if (expectedReleaseTag === undefined) return;
  const kind = catalogReleaseKind(expectedReleaseTag);
  if (
    !releases.some(
      (release) => release.tag_name === expectedReleaseTag && !release.draft && !release.prerelease,
    )
  )
    throw new ToolReleaseError(
      "Triggering release must be public and stable in complete enumeration",
    );
  return kind;
}
