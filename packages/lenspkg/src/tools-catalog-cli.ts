#!/usr/bin/env node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BootstrapManifest } from "./catalog-building/bootstrap.ts";
import { buildToolCatalog } from "./catalog-building/build.ts";
import { assertCatalogBuildEnvironment } from "./catalog-building/environment.ts";
import { readOfflineCatalogFixture } from "./catalog-building/offline.ts";
import { preflightCatalogSite, writeCatalogSite } from "./catalog-building/site.ts";
import { copyLegacySnapshots } from "./catalog-building/snapshots.ts";
import { createGitHubCatalogSource, type ToolCatalogSource } from "./catalog-building/source.ts";
import { ToolReleaseError } from "./publishing/error.ts";

async function run(): Promise<void> {
  const [command, fixturePath, dryOutput] = process.argv.slice(2);
  if (!["build-site", "snapshots", "dry-run"].includes(command ?? ""))
    throw new ToolReleaseError(
      "Usage: tools-catalog-cli.ts build-site|snapshots|dry-run <fixture.json> <output>",
    );
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "lensdesk-catalog-build-"));
  try {
    let source: ToolCatalogSource;
    let publicKey: string;
    let bootstrapManifest: BootstrapManifest | undefined;
    let expectedReleaseTag: string | undefined;
    if (command === "dry-run") {
      if (!fixturePath || !dryOutput)
        throw new ToolReleaseError("Offline fixture and output are required");
      ({ source, publicKey, bootstrapManifest } = await readOfflineCatalogFixture(
        path.resolve(fixturePath),
      ));
    } else {
      const environment = assertCatalogBuildEnvironment(process.env);
      // A reusable caller retains its original tag context despite checkout(main).
      // App snapshots run before publication, so only the post-publication site requires it.
      if (command === "build-site") expectedReleaseTag = environment.expectedReleaseTag;
      const token = process.env.GITHUB_TOKEN ?? "";
      if (command === "build-site")
        await preflightCatalogSite({
          token,
          initialize: process.env.CATALOG_INITIALIZE === "true",
          manual: environment.manualInitialization,
        });
      source = createGitHubCatalogSource(token);
      publicKey = await fs.readFile("apps/desktop/resources/keys/release.pub", "utf8");
    }
    const built = await buildToolCatalog({
      source,
      publicKey,
      bootstrapManifest,
      expectedReleaseTag,
      directory: path.join(temporary, "packages"),
      now: () => new Date(),
    });
    const output = path.resolve(
      command === "dry-run"
        ? (dryOutput ?? "")
        : command === "snapshots"
          ? "release-assets"
          : "catalog-site",
    );
    if (command === "snapshots") await copyLegacySnapshots(built, output);
    else await writeCatalogSite(built.catalog, output);
    console.log(
      JSON.stringify({ verified: true, candidates: built.catalog.releases.length, output }),
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  run().catch((error: unknown) => {
    console.error(
      error instanceof ToolReleaseError ? error.message : "Tool catalog failed validation",
    );
    process.exitCode = 1;
  });
