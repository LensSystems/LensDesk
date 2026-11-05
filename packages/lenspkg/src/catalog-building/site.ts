import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  OFFICIAL_TOOLS_CATALOG_URL,
  OFFICIAL_TOOLS_REPOSITORY,
  type ToolCatalog,
} from "../catalog/contract.ts";
import { parseToolCatalog } from "../catalog/parse.ts";
import { ToolReleaseError } from "../publishing/error.ts";
import { createGitHubReleaseHttp } from "../publishing/github-http.ts";

export const CATALOG_SITE_URL = new URL("./", OFFICIAL_TOOLS_CATALOG_URL).href;
export const CATALOG_SITE_MARKER_NAME = "lensdesk-tools-catalog-site.json";
export const CATALOG_SITE_MARKER = `${JSON.stringify({ schemaVersion: 1, repository: OFFICIAL_TOOLS_REPOSITORY, service: "lensdesk-tools-catalog", catalog: "tools-catalog-v1.json" })}\n`;
export const CATALOG_SITE_INDEX =
  '<!doctype html><html lang="en"><meta charset="utf-8"><title>LensDesk tools catalog</title><p>Official LensDesk tools metadata: <a href="tools-catalog-v1.json">tools-catalog-v1.json</a>.</p></html>\n';
const SMALL_RESPONSE_BYTES = 16 * 1024;

async function siteText(url: string, fetcher: typeof fetch): Promise<string | null> {
  const response = await fetcher(url, {
    method: "GET",
    redirect: "manual",
    credentials: "omit",
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json, text/html;q=0.9" },
  });
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  if (
    response.status !== 200 ||
    Number(response.headers.get("content-length")) > SMALL_RESPONSE_BYTES
  ) {
    await response.body?.cancel();
    throw new ToolReleaseError("Catalog site responded unexpectedly");
  }
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (reader)
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > SMALL_RESPONSE_BYTES) {
        await reader.cancel();
        throw new ToolReleaseError("Catalog site response exceeds limit");
      }
      chunks.push(value);
    }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function preflightCatalogSite(options: {
  token: string;
  initialize: boolean;
  manual: boolean;
  fetcher?: typeof fetch;
}): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  const http = createGitHubReleaseHttp(options.token, fetcher);
  const pages = z
    .object({
      html_url: z.literal(CATALOG_SITE_URL),
      build_type: z.literal("workflow"),
      cname: z.null(),
    })
    .safeParse(await http.json("GET", `/repos/${OFFICIAL_TOOLS_REPOSITORY}/pages`));
  if (!pages.success)
    throw new ToolReleaseError(
      "Pages must already be configured for this repository and Actions source",
    );
  const marker = await siteText(new URL(CATALOG_SITE_MARKER_NAME, CATALOG_SITE_URL).href, fetcher);
  const index = await siteText(CATALOG_SITE_URL, fetcher);
  if (marker === CATALOG_SITE_MARKER && index === CATALOG_SITE_INDEX) return;
  if (marker === null && index === null && options.initialize && options.manual) return;
  throw new ToolReleaseError(
    "Catalog site ownership is unconfirmed; refusing to replace existing content",
  );
}

export async function writeCatalogSite(catalog: ToolCatalog, directory: string): Promise<void> {
  const bytes = `${JSON.stringify(catalog)}\n`;
  parseToolCatalog(bytes);
  await fs.mkdir(directory, { recursive: true });
  const allowed = new Map([
    ["index.html", CATALOG_SITE_INDEX],
    [CATALOG_SITE_MARKER_NAME, CATALOG_SITE_MARKER],
  ]);
  for (const name of await fs.readdir(directory)) {
    if ((await fs.lstat(path.join(directory, name))).isSymbolicLink())
      throw new ToolReleaseError("Local site directory contains a symlink");
    if (name === "tools-catalog-v1.json") continue;
    if (
      !allowed.has(name) ||
      (await fs.readFile(path.join(directory, name), "utf8")) !== allowed.get(name)
    )
      throw new ToolReleaseError("Local site directory contains unrelated content");
  }
  const temporary = await fs.mkdtemp(
    path.join(path.dirname(path.resolve(directory)), ".lensdesk-catalog-write-"),
  );
  try {
    const file = path.join(temporary, "tools-catalog-v1.json");
    await fs.writeFile(file, bytes);
    for (const [name, content] of allowed) await fs.writeFile(path.join(directory, name), content);
    await fs.rename(file, path.join(directory, "tools-catalog-v1.json"));
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
