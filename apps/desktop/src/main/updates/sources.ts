import { parseToolCatalog, TOOL_CATALOG_LIMITS, toolsCatalogUrl } from "@lensdesk/lenspkg";
import semver from "semver";
import { z } from "zod";
import type { AppUpdateInfo } from "../../shared/update-types.ts";
import { pickInstallerAsset, releasesUrl } from "./check.ts";
import { APP_RELEASE_BYTES, readUpdateText, type UpdateHttpFetch } from "./network.ts";

export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const validUpdateRepo = (repo: string) =>
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/.test(repo) &&
  !repo.split("/").some((part) => part === "." || part === "..");
const releaseSchema = z.object({
  tag_name: z.string().min(1).max(128),
  html_url: z.string().max(2048),
  assets: z
    .array(z.object({ name: z.string().max(256), browser_download_url: z.string().max(2048) }))
    .max(1000)
    .optional(),
});
// GitHub repository identities are case-insensitive. All remaining URL bytes
// stay exact: no URL normalization, credentials, encoded aliases or extra suffixes.
function matchesReleaseUrl(actual: string, repo: string, tag: string, name?: string): boolean {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)(\/[\s\S]*)$/.exec(
    actual,
  );
  const [owner, repository] = repo.split("/");
  const suffix = `/releases/${name === undefined ? `tag/${tag}` : `download/${tag}/${name}`}`;
  return Boolean(
    match &&
      match[1]?.toLowerCase() === owner?.toLowerCase() &&
      match[2]?.toLowerCase() === repository?.toLowerCase() &&
      match[3] === suffix,
  );
}

export async function readAppUpdate(options: {
  repo: string;
  currentVersion: string;
  platform?: string;
  arch?: string;
  fetch: UpdateHttpFetch;
  timeoutMs?: number;
}): Promise<AppUpdateInfo | null> {
  if (!validUpdateRepo(options.repo)) throw new Error("Invalid releases repository");
  const release = releaseSchema.parse(
    JSON.parse(
      await readUpdateText({
        url: releasesUrl(options.repo),
        accept: "application/vnd.github+json",
        maxBytes: APP_RELEASE_BYTES,
        fetch: options.fetch,
        timeoutMs: options.timeoutMs,
      }),
    ),
  );
  const version = semver.valid(release.tag_name.replace(/^v/, ""));
  if (
    !version ||
    semver.prerelease(version) !== null ||
    !matchesReleaseUrl(release.html_url, options.repo, release.tag_name)
  )
    throw new Error("Invalid app release identity");
  const assets = (release.assets ?? []).filter(
    (asset) =>
      /^[A-Za-z0-9._-]+$/.test(asset.name) &&
      matchesReleaseUrl(asset.browser_download_url, options.repo, release.tag_name, asset.name),
  );
  if (!semver.gt(version, options.currentVersion)) return null;
  const installer = pickInstallerAsset(assets, options.platform ?? "", options.arch ?? "", version);
  return {
    version,
    html_url: release.html_url,
    ...(installer ? { installerUrl: installer.browser_download_url } : {}),
  };
}
export async function readToolsCatalog(options: {
  repo: string;
  fetch: UpdateHttpFetch;
  timeoutMs?: number;
}) {
  const url = toolsCatalogUrl(options.repo);
  if (!url) throw new Error("No catalog associated with releases repository");
  return parseToolCatalog(
    await readUpdateText({
      url,
      accept: "application/json",
      maxBytes: TOOL_CATALOG_LIMITS.catalogBytes,
      fetch: options.fetch,
      timeoutMs: options.timeoutMs,
    }),
  );
}
