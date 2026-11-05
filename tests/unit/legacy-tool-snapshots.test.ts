import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkForUpdate } from "../../apps/desktop/src/main/updates/check.ts";
import { toolReleaseMetadataSchema } from "../../packages/lenspkg/src/catalog/contract.ts";
import { selectToolCatalogUpdates } from "../../packages/lenspkg/src/catalog/select.ts";
import { buildToolCatalog } from "../../packages/lenspkg/src/catalog-building/build.ts";
import {
  copyLegacySnapshots,
  selectLegacySnapshots,
} from "../../packages/lenspkg/src/catalog-building/snapshots.ts";
import { catalogFixture } from "../../packages/lenspkg/src/catalog-building/test-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("snapshots de la app para el detector legado", () => {
  it("el detector0.4 anuncia una compatible aunque el catálogo contiene una superior incompatible", async () => {
    const f = await catalogFixture();
    roots.push(f.root);
    await f.addTool("notes", "0.4.5");
    await f.addTool("notes", "0.6.0", "0.6.0");
    await f.addTool("new-tool", "1.0.0", "0.6.0");
    const built = await buildToolCatalog({
      source: f.source,
      bootstrapManifest: f.bootstrapManifest,
      publicKey: f.keys.publicKeyPem,
      directory: path.join(f.root, "cache"),
      now: () => new Date("2026-11-04T12:00:00.000Z"),
    });
    expect(
      built.catalog.releases.some(
        (release) => release.id === "notes" && release.version === "0.6.0",
      ),
    ).toBe(true);
    const output = path.join(f.root, "snapshots");
    const names = await copyLegacySnapshots(built, output);
    expect(names).toEqual(["md-converter-0.4.0.lenspkg", "notes-0.4.5.lenspkg"]);
    async function oldDetector(assetNames: string[]) {
      return checkForUpdate({
        repo: "LensSystems/LensDesk",
        enabled: true,
        lastCheckedAt: null,
        now: () => new Date("2026-11-04T12:00:00.000Z"),
        currentVersion: "0.4.0",
        installedTools: () => [{ id: "notes", version: "0.4.0" }],
        fetch: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            tag_name: "v0.5.0",
            html_url: "https://github.com/LensSystems/LensDesk/releases/tag/v0.5.0",
            assets: assetNames.map((name) => ({
              name,
              browser_download_url: `https://github.com/LensSystems/LensDesk/releases/download/v0.5.0/${name}`,
            })),
          }),
        }),
      });
    }
    expect(await oldDetector([...names, "notes-0.6.0.lenspkg"])).toMatchObject({
      tools: [{ id: "notes", version: "0.6.0" }],
    });
    expect(await oldDetector(await fs.readdir(output))).toMatchObject({
      tools: [{ id: "notes", version: "0.4.5" }],
    });
    expect(
      selectToolCatalogUpdates(
        built.catalog,
        [{ id: "notes", version: "0.4.0" }],
        "0.6.0",
      ).updates.map((release) => release.version),
    ).toEqual(["0.6.0"]);
    const apiTwo = toolReleaseMetadataSchema.parse({
      ...built.catalog.releases.find((r) => r.id === "notes" && r.version === "0.6.0"),
      version: "2.0.0",
      apiVersion: 2,
      minHostVersion: "0.1.0",
      releaseTag: "notes-v2.0.0",
      asset: {
        name: "notes-2.0.0.lenspkg",
        url: "https://github.com/LensSystems/LensDesk/releases/download/notes-v2.0.0/notes-2.0.0.lenspkg",
        size: 1,
        sha256: "a".repeat(64),
      },
      notesUrl: "https://github.com/LensSystems/LensDesk/releases/tag/notes-v2.0.0",
    });
    expect(
      selectLegacySnapshots({
        ...built.catalog,
        releases: [...built.catalog.releases, apiTwo],
      }).find((release) => release.id === "notes")?.version,
    ).toBe("0.4.5");
    await fs.writeFile(path.join(output, "notes-0.6.0.lenspkg"), "must not publish");
    await expect(copyLegacySnapshots(built, output)).rejects.toThrow(/outside/);
  });
});
