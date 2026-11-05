import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SUPPORTED_API_VERSIONS, type ToolManifest, toolManifestSchema } from "@lensdesk/sdk";
import semver from "semver";
import { OFFICIAL_TOOLS_REPOSITORY, TOOL_CATALOG_LIMITS } from "../catalog/contract.ts";
import { ToolReleaseError } from "./error.ts";

export type ToolReleaseSource = {
  tag: string;
  directory: string;
  relativeDirectory: string;
  manifest: ToolManifest;
};

export function parseToolReleaseTag(tag: string): { id: string; version: string } {
  const match = /^([a-z][a-z0-9-]{1,39})-v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(
    tag,
  );
  if (
    !match?.[1] ||
    match[0] !== tag ||
    !match[2] ||
    match[2].length > 64 ||
    semver.valid(match[2]) !== match[2]
  )
    throw new ToolReleaseError("Invalid tool release tag");
  if (match[2] === "0.4.0" && ["notes", "md-converter"].includes(match[1]))
    throw new ToolReleaseError("Tool version is reserved for the original bootstrap release");
  return { id: match[1], version: match[2] };
}

async function readJson(file: string): Promise<unknown> {
  if ((await fs.stat(file)).size > TOOL_CATALOG_LIMITS.metadataBytes)
    throw new ToolReleaseError("Tool manifest or package exceeds size limit");
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function resolveToolRelease(root: string, tag: string): Promise<ToolReleaseSource> {
  const expected = parseToolReleaseTag(tag);
  const tools = path.join(await fs.realpath(root), "tools");
  if ((await fs.realpath(tools)) !== tools) throw new ToolReleaseError("Tools root is a symlink");
  const found = new Map<string, ToolReleaseSource>();
  for (const item of await fs.readdir(tools, { withFileTypes: true })) {
    if (item.name === "_template" || !item.isDirectory()) continue;
    if (/^[a-z][a-z0-9-]{1,39}$/.exec(item.name)?.[0] !== item.name)
      throw new ToolReleaseError("Invalid tool directory name");
    const directory = path.join(tools, item.name);
    if ((await fs.realpath(directory)) !== directory)
      throw new ToolReleaseError("Tool directory is a symlink");
    const manifestFile = path.join(directory, "lensdesk.tool.json");
    const packageFile = path.join(directory, "package.json");
    for (const file of [manifestFile, packageFile])
      if ((await fs.realpath(file)) !== file)
        throw new ToolReleaseError("Tool metadata is a symlink");
    const manifest = toolManifestSchema.parse(await readJson(manifestFile));
    const pkg = (await readJson(packageFile)) as { version?: unknown };
    if (manifest.version !== pkg.version || found.has(manifest.id))
      throw new ToolReleaseError("Duplicate tool ID or mismatched package version");
    found.set(manifest.id, { tag, directory, relativeDirectory: `tools/${item.name}`, manifest });
  }
  const source = found.get(expected.id);
  if (
    !source ||
    source.manifest.version !== expected.version ||
    !(SUPPORTED_API_VERSIONS as readonly number[]).includes(source.manifest.apiVersion)
  )
    throw new ToolReleaseError("Tag does not select a supported installed source manifest");
  return source;
}

export function assertToolReleaseEnvironment(
  env: NodeJS.ProcessEnv,
  git: (args: string[]) => string = (args) =>
    execFileSync("git", args, { encoding: "utf8" }).trim(),
): { tag: string; commit: string } {
  const tag = env.GITHUB_REF_NAME ?? "";
  parseToolReleaseTag(tag);
  const commit = env.GITHUB_SHA ?? "";
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.GITHUB_REPOSITORY !== OFFICIAL_TOOLS_REPOSITORY ||
    env.GITHUB_REF_TYPE !== "tag" ||
    !/^[a-f0-9]{40}$/.test(commit)
  )
    throw new ToolReleaseError("Tool publication requires an official tag workflow");
  if (git(["rev-parse", "--verify", `refs/tags/${tag}^{commit}`]) !== commit)
    throw new ToolReleaseError("Tag and workflow commit differ");
  git(["merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"]);
  return { tag, commit };
}
