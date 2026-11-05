import { execFileSync } from "node:child_process";
import { OFFICIAL_TOOLS_REPOSITORY } from "../catalog/contract.ts";
import { ToolReleaseError } from "../publishing/error.ts";
import { catalogReleaseKind } from "./trigger.ts";

export function assertCatalogBuildEnvironment(
  env: NodeJS.ProcessEnv,
  git: (args: string[]) => string = (args) =>
    execFileSync("git", args, { encoding: "utf8" }).trim(),
): { manualInitialization: boolean; expectedReleaseTag?: string } {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== OFFICIAL_TOOLS_REPOSITORY)
    throw new ToolReleaseError("Catalog production reads require the official workflow");
  if (git(["rev-parse", "HEAD"]) !== git(["rev-parse", "refs/remotes/origin/main"]))
    throw new ToolReleaseError("Catalog builder must use the current trusted main checkout");
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_REF === "refs/heads/main")
    return { manualInitialization: true };
  const tag = env.GITHUB_REF_NAME ?? "";
  catalogReleaseKind(tag);
  const commit = env.GITHUB_SHA ?? "";
  if (
    env.GITHUB_REF_TYPE !== "tag" ||
    env.GITHUB_REF !== `refs/tags/${tag}` ||
    !/^[a-f0-9]{40}$/.test(commit) ||
    commit.length !== 40 ||
    git(["rev-parse", "--verify", `refs/tags/${tag}^{commit}`]) !== commit
  )
    throw new ToolReleaseError("Catalog caller must be an integrated release tag");
  git(["merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"]);
  return { manualInitialization: false, expectedReleaseTag: tag };
}
