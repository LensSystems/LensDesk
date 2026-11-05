import { z } from "zod";
import { OFFICIAL_TOOLS_REPOSITORY } from "../catalog/contract.ts";
import { ToolReleaseError } from "./error.ts";
import { createGitHubReleaseHttp } from "./github-http.ts";
import type { RemoteToolRelease, ToolReleaseClient } from "./publish.ts";
import { parseToolReleaseTag } from "./source.ts";

const ROOT = `/repos/${OFFICIAL_TOOLS_REPOSITORY}`;
export const TOOL_RELEASE_MAX_PAGES = 100;
const idSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const releaseSchema = z.object({
  id: idSchema,
  tag_name: z.string().max(256),
  target_commitish: z.string().max(256),
  draft: z.boolean(),
  prerelease: z.boolean(),
});
const assetSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(256),
  size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  state: z.string().max(32),
});
const gitObjectSchema = z.object({
  object: z.object({ type: z.enum(["tag", "commit"]), sha: z.string().regex(/^[a-f0-9]{40}$/) }),
});
function parseRelease(value: unknown): RemoteToolRelease {
  const result = releaseSchema.safeParse(value);
  if (!result.success) throw new ToolReleaseError("Invalid GitHub release response");
  return result.data;
}

export function createGitHubToolReleaseClient(
  token: string,
  fetcher: typeof fetch = fetch,
): ToolReleaseClient {
  const http = createGitHubReleaseHttp(token, fetcher);
  return {
    async assertTagCommit(tag, commit) {
      parseToolReleaseTag(tag);
      let object = gitObjectSchema.parse(
        await http.json("GET", `${ROOT}/git/ref/tags/${tag}`),
      ).object;
      let depth = 0;
      while (object.type === "tag") {
        if (++depth > 10) throw new ToolReleaseError("Tag indirection exceeds limit");
        object = gitObjectSchema.parse(
          await http.json("GET", `${ROOT}/git/tags/${object.sha}`),
        ).object;
      }
      if (object.sha !== commit)
        throw new ToolReleaseError("Remote tag moved from the verified commit");
    },
    async find(tag) {
      parseToolReleaseTag(tag);
      let found: RemoteToolRelease | null = null;
      for (let page = 1; page <= TOOL_RELEASE_MAX_PAGES; page++) {
        const result = z
          .array(releaseSchema)
          .max(100)
          .safeParse(await http.json("GET", `${ROOT}/releases?per_page=100&page=${page}`));
        if (!result.success) throw new ToolReleaseError("Invalid paginated release response");
        for (const release of result.data) {
          if (release.tag_name !== tag) continue;
          if (found) throw new ToolReleaseError("Duplicate releases for one tag");
          found = release;
        }
        if (result.data.length < 100) return found;
      }
      throw new ToolReleaseError("Release pagination exceeds limit");
    },
    async createDraft(tag, commit) {
      parseToolReleaseTag(tag);
      return parseRelease(
        await http.json("POST", `${ROOT}/releases`, {
          tag_name: tag,
          target_commitish: commit,
          name: tag,
          body: `Paquete oficial de herramienta: ${tag}.`,
          draft: true,
          prerelease: false,
          make_latest: "false",
        }),
      );
    },
    async listAssets(id) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new ToolReleaseError("Invalid release ID");
      const result = z
        .array(assetSchema)
        .max(100)
        .safeParse(await http.json("GET", `${ROOT}/releases/${id}/assets?per_page=100&page=1`));
      if (!result.success) throw new ToolReleaseError("Invalid GitHub asset response");
      return result.data;
    },
    downloadAsset: http.downloadAsset,
    uploadAsset: http.uploadAsset,
    async publish(id) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new ToolReleaseError("Invalid release ID");
      return parseRelease(
        await http.json("PATCH", `${ROOT}/releases/${id}`, {
          draft: false,
          prerelease: false,
          make_latest: "false",
        }),
      );
    },
  };
}
