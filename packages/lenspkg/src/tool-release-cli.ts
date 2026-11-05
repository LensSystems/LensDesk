#!/usr/bin/env node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPair } from "./keys.ts";
import { loadToolRelease, prepareToolRelease } from "./publishing/artifacts.ts";
import { ToolReleaseError } from "./publishing/error.ts";
import { createGitHubToolReleaseClient } from "./publishing/github-client.ts";
import { publishToolRelease } from "./publishing/publish.ts";
import { assertToolReleaseEnvironment, resolveToolRelease } from "./publishing/source.ts";

async function output(values: Record<string, string>): Promise<void> {
  if (process.env.GITHUB_OUTPUT)
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(""),
    );
  console.log(JSON.stringify(values));
}
async function run(): Promise<void> {
  const command = process.argv[2];
  if (!["resolve", "dry-run", "prepare", "publish"].includes(command ?? ""))
    throw new ToolReleaseError("Usage: tool-release-cli.ts resolve|dry-run|prepare|publish");
  const context =
    command === "dry-run" && process.env.GITHUB_ACTIONS !== "true"
      ? { tag: process.argv[3] ?? "", commit: "" }
      : assertToolReleaseEnvironment(process.env);
  const { tag, commit } = context;
  const source = await resolveToolRelease(process.cwd(), tag);
  if (command === "resolve") {
    await output({
      directory: source.relativeDirectory,
      id: source.manifest.id,
      version: source.manifest.version,
    });
    return;
  }
  const directory =
    command === "dry-run"
      ? await fs.mkdtemp(path.join(os.tmpdir(), "lensdesk-release-dry-run-"))
      : path.resolve("release-tool");
  if (command === "dry-run") {
    const keys = generateKeyPair();
    await prepareToolRelease(source, directory, keys);
    await output({ verified: tag, output_directory: directory });
    return;
  }
  const publicKey = await fs.readFile("apps/desktop/resources/keys/release.pub", "utf8");
  if (command === "prepare") {
    const privateKeyPem = process.env.LENSPKG_SIGNING_KEY;
    if (!privateKeyPem) throw new ToolReleaseError("Release signing secret is not configured");
    await prepareToolRelease(source, directory, { privateKeyPem, publicKeyPem: publicKey });
    await output({ verified: tag });
    return;
  }
  const bundle = await loadToolRelease(source, directory, publicKey);
  const result = await publishToolRelease(
    bundle,
    commit,
    createGitHubToolReleaseClient(process.env.GITHUB_TOKEN ?? ""),
  );
  await output({ published: "true", catalog_release_tag: result.catalogReleaseTag });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  run().catch((error: unknown) => {
    console.error(
      error instanceof ToolReleaseError ? error.message : "Tool release failed validation",
    );
    process.exitCode = 1;
  });
