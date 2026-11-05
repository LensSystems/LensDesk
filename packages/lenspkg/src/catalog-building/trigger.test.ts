import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildToolCatalog } from "./build.ts";
import { assertCatalogBuildEnvironment } from "./environment.ts";
import { writeCatalogSite } from "./site.ts";
import { catalogFixture } from "./test-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
const commit = "a".repeat(40);
const caller = (tag: string) => ({
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "LensSystems/LensDesk",
  GITHUB_EVENT_NAME: "push",
  GITHUB_REF_TYPE: "tag",
  GITHUB_REF: `refs/tags/${tag}`,
  GITHUB_REF_NAME: tag,
  GITHUB_SHA: commit,
});
const git = (args: string[]) => (args[0] === "merge-base" ? "" : commit);
async function fixture() {
  const f = await catalogFixture();
  roots.push(f.root);
  return f;
}
function build(f: Awaited<ReturnType<typeof fixture>>, name: string, expectedReleaseTag?: string) {
  return buildToolCatalog({
    source: f.source,
    publicKey: f.keys.publicKeyPem,
    directory: path.join(f.root, name),
    now: () => new Date("2026-11-04T12:00:00.000Z"),
    bootstrapManifest: f.bootstrapManifest,
    expectedReleaseTag,
  });
}

describe("presencia de la release disparadora antes de sustituir el catálogo", () => {
  it.each(["tool", "app"])(
    "conserva el último índice si la disparadora %s está ausente/draft/prerelease",
    async (kind) => {
      const f = await fixture();
      const first = await f.addTool("notes", "0.4.5");
      const tag = kind === "tool" ? first.release.tag_name : "v0.5.0";
      const trigger = kind === "tool" ? first.release : f.addRelease(tag, []);
      const environment = assertCatalogBuildEnvironment(caller(tag), git);
      expect(environment.expectedReleaseTag).toBe(tag);
      const site = path.join(f.root, "site");
      await writeCatalogSite(
        (await build(f, "valid", environment.expectedReleaseTag)).catalog,
        site,
      );
      const previous = await fs.readFile(path.join(site, "tools-catalog-v1.json"));
      for (const state of ["absent", "draft", "prerelease"]) {
        f.releases.splice(f.releases.indexOf(trigger), 1);
        if (state !== "absent") {
          trigger.draft = state === "draft";
          trigger.prerelease = state === "prerelease";
          f.releases.push(trigger);
        }
        await expect(
          (async () => {
            const built = await build(f, state, environment.expectedReleaseTag);
            await writeCatalogSite(built.catalog, site);
          })(),
        ).rejects.toThrow(/Triggering release must be public and stable/);
        expect(await fs.readFile(path.join(site, "tools-catalog-v1.json"))).toEqual(previous);
        if (state === "absent") f.releases.push(trigger);
      }
    },
  );

  it("exige metadata verificable de herramienta y admite app sin entrada de herramienta", async () => {
    const f = await fixture();
    const tool = await f.addTool("viewer", "1.0.0");
    const tag = tool.release.tag_name;
    const good = await build(
      f,
      "tool",
      assertCatalogBuildEnvironment(caller(tag), git).expectedReleaseTag,
    );
    expect(good.catalog.releases.some((entry) => entry.releaseTag === tag)).toBe(true);
    f.addRelease("v0.5.0", []);
    const app = await build(
      f,
      "app",
      assertCatalogBuildEnvironment(caller("v0.5.0"), git).expectedReleaseTag,
    );
    expect(app.catalog.releases).toEqual(good.catalog.releases);
    f.assets.set(
      tool.release.id,
      (f.assets.get(tool.release.id) ?? []).filter((asset) => asset.name !== "tool-release.json"),
    );
    await expect(build(f, "missing-metadata", tag)).rejects.toThrow();
  });

  it("la reconstrucción siguiente incluye ambas publicaciones aunque cambie el orden", async () => {
    const f = await fixture();
    const first = await f.addTool("viewer", "1.0.0");
    const before = await build(f, "first", first.release.tag_name);
    const second = await f.addTool("viewer", "1.1.0");
    f.releases.reverse();
    const after = await build(f, "next", second.release.tag_name);
    expect(after.catalog.releases).toEqual(expect.arrayContaining(before.catalog.releases));
    expect(
      after.catalog.releases.some((entry) => entry.releaseTag === second.release.tag_name),
    ).toBe(true);
    // A queued earlier caller rebuilding the latest complete history also retains both.
    expect((await build(f, "queued", first.release.tag_name)).catalog).toEqual(after.catalog);
  });

  it("dispatch main no inventa disparadora; tag válido requiere identidad y commit del caller", async () => {
    const manual = assertCatalogBuildEnvironment(
      {
        ...caller("notes-v1.2.3"),
        GITHUB_EVENT_NAME: "workflow_dispatch",
        GITHUB_REF_TYPE: "branch",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REF_NAME: "main",
      },
      git,
    );
    expect(manual.expectedReleaseTag).toBeUndefined();
    const f = await fixture();
    expect((await build(f, "manual", manual.expectedReleaseTag)).catalog.releases).toHaveLength(2);
    const command = vi.fn(git);
    expect(() =>
      assertCatalogBuildEnvironment(
        { ...caller("viewer-v1.0.0"), GITHUB_REF: "refs/tags/other-v1.0.0" },
        command,
      ),
    ).toThrow(/integrated/);
    expect(() =>
      assertCatalogBuildEnvironment(caller("viewer-v1.0.0"), (args) =>
        args.includes("--verify") ? "b".repeat(40) : git(args),
      ),
    ).toThrow(/integrated/);
    expect(() =>
      assertCatalogBuildEnvironment(
        { ...caller("viewer-v1.0.0"), GITHUB_REPOSITORY: "evil/fork" },
        command,
      ),
    ).toThrow(/official/);
  });

  it.each(["../viewer-v1.0.0", "viewer-v1.0.0;echo bad", "v01.2.3", "viewer-v1.0.0-beta.1"])(
    "rechaza tag malicioso/no estable %s en contexto y generador",
    async (tag) => {
      const f = await fixture();
      expect(() => assertCatalogBuildEnvironment(caller(tag), git)).toThrow();
      await expect(build(f, "invalid", tag)).rejects.toThrow();
    },
  );
});
