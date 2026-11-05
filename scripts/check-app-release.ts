import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Check release identity before dependency installation or building installers. */
export function assertAppReleaseVersion(
  tag: string,
  rootVersion: unknown,
  desktopVersion: unknown,
): string {
  if (typeof rootVersion !== "string" || rootVersion !== desktopVersion)
    throw new Error("Root and desktop versions must match");
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(rootVersion);
  if (
    !match ||
    match[0] !== rootVersion ||
    rootVersion.length > 64 ||
    !match.slice(1).every((component) => Number.isSafeInteger(Number(component)))
  )
    throw new Error("App version must be canonical stable X.Y.Z");
  if (tag !== `v${rootVersion}`) throw new Error("App tag must match the root and desktop version");
  return rootVersion;
}

export async function checkAppRelease(root: string, tag: string): Promise<string> {
  const versions = await Promise.all(
    ["package.json", "apps/desktop/package.json"].map(async (file) => {
      const json: unknown = JSON.parse(await readFile(path.join(root, file), "utf8"));
      return json && typeof json === "object" && "version" in json ? json.version : undefined;
    }),
  );
  return assertAppReleaseVersion(tag, versions[0], versions[1]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  checkAppRelease(process.cwd(), process.argv[2] ?? process.env.GITHUB_REF_NAME ?? "")
    .then((version) => console.log(`App release version verified: ${version}`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "App release version check failed");
      process.exitCode = 1;
    });
