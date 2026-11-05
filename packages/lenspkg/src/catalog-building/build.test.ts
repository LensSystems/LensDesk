import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateKeyPair } from "../keys.ts";
import { packTool } from "../pack.ts";
import { releaseSha256 } from "../publishing/artifacts.ts";
import { verifyPackage } from "../verify.ts";
import { buildToolCatalog } from "./build.ts";
import { CATALOG_SITE_MARKER_NAME, writeCatalogSite } from "./site.ts";
import { copyLegacySnapshots } from "./snapshots.ts";
import { catalogFixture } from "./test-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const value = await catalogFixture();
  roots.push(value.root);
  return value;
}
const now = () => new Date("2026-11-04T12:00:00.000Z");
const build = (f: Awaited<ReturnType<typeof fixture>>, name = "cache") =>
  buildToolCatalog({
    source: f.source,
    bootstrapManifest: f.bootstrapManifest,
    publicKey: f.keys.publicKeyPem,
    directory: path.join(f.root, name),
    now,
  });

function updateMetadata(
  f: Awaited<ReturnType<typeof fixture>>,
  releaseId: number,
  change: (metadata: Record<string, unknown>) => void,
) {
  const assets = f.assets.get(releaseId) ?? [];
  const sidecar = assets.find((asset) => asset.name === "tool-release.json");
  const sums = assets.find((asset) => asset.name === "SHA256SUMS.txt");
  if (!sidecar || !sums) throw Error("Missing fixture metadata");
  const metadata = JSON.parse(new TextDecoder().decode(f.bytes.get(sidecar.id))) as Record<
    string,
    unknown
  >;
  change(metadata);
  f.replaceAsset(sidecar, new TextEncoder().encode(`${JSON.stringify(metadata, null, 2)}\n`));
  const entries = assets
    .filter((asset) => asset !== sums)
    .map((asset) => `${releaseSha256(f.bytes.get(asset.id) ?? new Uint8Array())}  ${asset.name}`)
    .sort()
    .join("\n");
  f.replaceAsset(sums, new TextEncoder().encode(`${entries}\n`));
}

describe("reconstrucción íntegra del catálogo", () => {
  it("incluye bootstrap, versiones independientes y nueva oficial en varias páginas", async () => {
    const f = await fixture();
    for (let i = 0; i < 99; i++)
      f.releases.push({ id: 10_000 + i, tag_name: `v1.0.${i}`, draft: false, prerelease: false });
    await f.addTool("notes", "0.4.5");
    await f.addTool("notes", "0.6.0", "0.6.0");
    await f.addTool("new-tool", "1.0.0");
    f.addRelease("draft-tool-v1.0.0", [], { draft: true });
    f.addRelease("beta-tool-v1.0.0", [], { prerelease: true });
    const built = await build(f);
    expect(built.catalog.releases.map((e) => `${e.id}@${e.version}`)).toEqual([
      "md-converter@0.4.0",
      "new-tool@1.0.0",
      "notes@0.4.0",
      "notes@0.4.5",
      "notes@0.6.0",
    ]);
    const snapshots = path.join(f.root, "snapshots");
    expect(await copyLegacySnapshots(built, snapshots)).toEqual([
      "md-converter-0.4.0.lenspkg",
      "new-tool-1.0.0.lenspkg",
      "notes-0.4.5.lenspkg",
    ]);
    for (const name of await fs.readdir(snapshots)) {
      const metadata = built.catalog.releases.find((entry) => entry.asset.name === name);
      expect(releaseSha256(await fs.readFile(path.join(snapshots, name)))).toBe(
        metadata?.asset.sha256,
      );
    }
    await expect(fs.stat(path.join(snapshots, "notes-0.6.0.lenspkg"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("es determinista salvo fecha y la reconstrucción siguiente conserva todas las publicaciones", async () => {
    const f = await fixture();
    await f.addTool("notes", "0.4.5");
    const first = await build(f, "first");
    f.releases.reverse();
    const reversed = await build(f, "reversed");
    expect(reversed.catalog).toEqual(first.catalog);
    await f.addTool("md-converter", "0.4.6");
    const next = await build(f, "next");
    expect(next.catalog.releases).toEqual(expect.arrayContaining(first.catalog.releases));
    expect(
      next.catalog.releases.some(
        (entry) => entry.id === "md-converter" && entry.version === "0.4.6",
      ),
    ).toBe(true);
  });

  it.each(["missing-metadata", "external-url", "manifest-mismatch", "bad-signature"])(
    "rechaza publicación relevante inválida %s y conserva último índice",
    async (kind) => {
      const f = await fixture();
      const tool = await f.addTool("notes", "0.4.5");
      const site = path.join(f.root, "site");
      await writeCatalogSite((await build(f, "valid")).catalog, site);
      const previous = await fs.readFile(path.join(site, "tools-catalog-v1.json"));
      const assets = f.assets.get(tool.release.id) ?? [];
      if (kind === "missing-metadata")
        f.assets.set(
          tool.release.id,
          assets.filter((asset) => asset.name !== "tool-release.json"),
        );
      if (kind === "external-url" && assets[0])
        assets[0].browser_download_url = "https://evil.test/package";
      if (kind === "manifest-mismatch")
        updateMetadata(f, tool.release.id, (metadata) => {
          metadata.apiVersion = 2;
        });
      if (kind === "bad-signature") {
        const wrong = generateKeyPair();
        const file = path.join(f.root, "wrong.lenspkg");
        const directory = path.join(f.root, "tools/source-notes-0-4-5/dist");
        await packTool(directory, {
          outFile: file,
          signing: { keyId: "release", privateKeyPem: wrong.privateKeyPem },
          reproducible: true,
        });
        const asset = assets.find((value) => value.name.endsWith(".lenspkg"));
        if (!asset) throw Error("Missing package");
        const bytes = await fs.readFile(file);
        f.replaceAsset(asset, bytes);
        updateMetadata(f, tool.release.id, (metadata) => {
          const value = metadata.asset as Record<string, unknown>;
          value.sha256 = releaseSha256(bytes);
          value.size = bytes.length;
        });
      }
      await expect(
        (async () => writeCatalogSite((await build(f, "invalid")).catalog, site))(),
      ).rejects.toThrow();
      expect(await fs.readFile(path.join(site, "tools-catalog-v1.json"))).toEqual(previous);
    },
  );

  it("rechaza bootstrap faltante o alterado y duplicados de enumeración", async () => {
    const absent = await fixture();
    absent.releases.length = 0;
    await expect(build(absent)).rejects.toThrow(/bootstrap/);
    const changed = await fixture();
    const asset = changed.assets
      .get(changed.bootstrap.id)
      ?.find((a) => a.name.endsWith(".lenspkg"));
    if (!asset) throw Error("Missing bootstrap");
    const original = changed.bytes.get(asset.id);
    if (!original) throw Error("Missing bytes");
    changed.replaceAsset(asset, new Uint8Array(original.length).fill(7));
    await expect(build(changed)).rejects.toThrow(/checksum/);
    const duplicate = await fixture();
    duplicate.releases.push(duplicate.bootstrap);
    await expect(build(duplicate)).rejects.toThrow(/repeated/);
  });

  it("el default de producción no acepta los anclajes generados de fixtures", async () => {
    const f = await fixture();
    await expect(
      buildToolCatalog({
        source: f.source,
        publicKey: f.keys.publicKeyPem,
        directory: path.join(f.root, "production-default"),
        now,
      }),
    ).rejects.toThrow(/immutable anchor/);
  });

  it.each(["notes", "md-converter"])(
    "rechaza reemplazo de %s correctamente firmado aun con sumas remotas actualizadas",
    async (id) => {
      const f = await fixture();
      const built = await build(f, "original");
      const site = path.join(f.root, "site");
      await writeCatalogSite(built.catalog, site);
      const previous = await fs.readFile(path.join(site, "tools-catalog-v1.json"));
      const directory = path.join(f.root, `tools/legacy-${id}/dist`);
      await fs.writeFile(path.join(directory, "ui/index.html"), "<h1>Otro contenido</h1>");
      const file = path.join(f.root, "replacement.lenspkg");
      await packTool(directory, {
        outFile: file,
        reproducible: true,
        signing: { keyId: "release", privateKeyPem: f.keys.privateKeyPem },
      });
      const verified = await verifyPackage(file, { trustedKeys: { release: f.keys.publicKeyPem } });
      expect(verified).toMatchObject({
        ok: true,
        signed: true,
        keyId: "release",
        manifest: { id, version: "0.4.0" },
      });
      const assets = f.assets.get(f.bootstrap.id) ?? [];
      const asset = assets.find((entry) => entry.name === `${id}-0.4.0.lenspkg`);
      const sums = assets.find((entry) => entry.name === "SHA256SUMS.txt");
      if (!asset || !sums) throw Error("Missing bootstrap assets");
      const bytes = await fs.readFile(file);
      expect(releaseSha256(bytes)).not.toBe(
        f.bootstrapManifest.find((entry) => entry.id === id)?.sha256,
      );
      f.replaceAsset(asset, bytes);
      f.replaceAsset(
        sums,
        new TextEncoder().encode(
          assets
            .filter((entry) => entry.name.endsWith(".lenspkg"))
            .map(
              (entry) =>
                `${releaseSha256(f.bytes.get(entry.id) ?? new Uint8Array())}  ${entry.name}\n`,
            )
            .join(""),
        ),
      );
      await expect(
        (async () => writeCatalogSite((await build(f, "substituted")).catalog, site))(),
      ).rejects.toThrow(/immutable anchor/);
      expect(await fs.readFile(path.join(site, "tools-catalog-v1.json"))).toEqual(previous);
    },
  );

  it("ofrece dry-run CLI offline y exporta solo JSON, marcador e índice", async () => {
    const f = await fixture();
    await f.addTool("new-tool", "1.0.0");
    const directory = path.join(f.root, "fixture");
    await fs.mkdir(path.join(directory, "files"), { recursive: true });
    const files: Record<string, string> = {};
    for (const [id, bytes] of f.bytes) {
      const relative = `files/${id}.bin`;
      files[String(id)] = relative;
      await fs.writeFile(path.join(directory, relative), bytes);
    }
    const fixtureFile = path.join(directory, "offline.json");
    await fs.writeFile(
      fixtureFile,
      JSON.stringify({
        publicKey: f.keys.publicKeyPem,
        bootstrapManifest: f.bootstrapManifest,
        releases: [f.releases],
        assets: Object.fromEntries([...f.assets].map(([id, assets]) => [id, [assets]])),
        files,
      }),
    );
    const output = path.join(f.root, "offline-site");
    const cli = spawnSync(
      process.execPath,
      [path.resolve("packages/lenspkg/src/tools-catalog-cli.ts"), "dry-run", fixtureFile, output],
      {
        cwd: f.root,
        encoding: "utf8",
        env: { ...process.env, GITHUB_TOKEN: "", LENSPKG_SIGNING_KEY: "" },
      },
    );
    expect(cli.status, cli.stderr).toBe(0);
    expect((await fs.readdir(output)).sort()).toEqual(
      ["index.html", CATALOG_SITE_MARKER_NAME, "tools-catalog-v1.json"].sort(),
    );
    expect(cli.stdout).not.toContain("PRIVATE KEY");
  });
});
