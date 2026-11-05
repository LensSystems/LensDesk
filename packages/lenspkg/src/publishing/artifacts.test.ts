import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseToolReleaseMetadata } from "../catalog/parse.ts";
import { generateKeyPair } from "../keys.ts";
import { verifyPackage } from "../verify.ts";
import { assertToolReleaseBundle, loadToolRelease, prepareToolRelease } from "./artifacts.ts";
import { resolveToolRelease } from "./source.ts";
import { fixtureTool, temporaryTools } from "./test-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await temporaryTools();
  roots.push(root);
  await fixtureTool(root, "notes");
  return { root, source: await resolveToolRelease(root, "notes-v1.2.3"), keys: generateKeyPair() };
}

describe("artefactos firmados por herramienta", () => {
  it("prepara exactamente paquete, metadata y sumas y los verifica con clave efímera", async () => {
    const { root, source, keys } = await fixture();
    const out = path.join(root, "output");
    const bundle = await prepareToolRelease(source, out, keys);
    expect(bundle.files.map((file) => file.name)).toEqual([
      "notes-1.2.3.lenspkg",
      "tool-release.json",
      "SHA256SUMS.txt",
    ]);
    expect(parseToolReleaseMetadata(bundle.files[1]?.bytes ?? new Uint8Array())).toEqual(
      bundle.metadata,
    );
    const loaded = await loadToolRelease(source, out, keys.publicKeyPem);
    expect(loaded.metadata).toEqual(bundle.metadata);
    expect(loaded.files.map((file) => ({ name: file.name, bytes: [...file.bytes] }))).toEqual(
      bundle.files.map((file) => ({ name: file.name, bytes: [...file.bytes] })),
    );
    expect(
      (
        await verifyPackage(path.join(out, bundle.metadata.asset.name), {
          trustedKeys: { release: keys.publicKeyPem },
        })
      ).ok,
    ).toBe(true);
    await expect(prepareToolRelease(source, out, keys)).rejects.toThrow(/empty/);
  });

  it("no firma ni escribe salidas para las versiones bootstrap reservadas", async () => {
    for (const id of ["notes", "md-converter"]) {
      const root = await temporaryTools();
      roots.push(root);
      const tool = await fixtureTool(root, id, id, "0.4.0");
      const source = { ...tool, tag: `${id}-v0.4.0`, relativeDirectory: `tools/${id}` };
      const out = path.join(root, "reserved");
      await expect(
        prepareToolRelease(source, out, { privateKeyPem: "not a key", publicKeyPem: "not a key" }),
      ).rejects.toThrow(/reserved/);
      await expect(fs.stat(out)).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  it("ofrece dry-run local sin token, claves privadas o tags Git de producción", async () => {
    const { root } = await fixture();
    const cli = path.resolve("packages/lenspkg/src/tool-release-cli.ts");
    const result = spawnSync(process.execPath, [cli, "dry-run", "notes-v1.2.3"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_ACTIONS: "false",
        GITHUB_TOKEN: "",
        LENSPKG_SIGNING_KEY: "",
        GITHUB_OUTPUT: "",
      },
    });
    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as { verified: string; output_directory: string };
    roots.push(output.output_directory);
    expect(output.verified).toBe("notes-v1.2.3");
    expect((await fs.readdir(output.output_directory)).sort()).toEqual([
      "SHA256SUMS.txt",
      "notes-1.2.3.lenspkg",
      "tool-release.json",
    ]);
    expect(result.stdout).not.toMatch(/BEGIN PRIVATE KEY/);
  });

  it("rechaza manifiesto firmado discrepante con el origen y firma de otra clave", async () => {
    const { root, source, keys } = await fixture();
    await fs.writeFile(
      path.join(source.directory, "dist/lensdesk.tool.json"),
      JSON.stringify({ ...source.manifest, minHostVersion: "0.5.0" }),
    );
    await expect(prepareToolRelease(source, path.join(root, "mismatch"), keys)).rejects.toThrow(
      /source manifest/,
    );
    await fs.writeFile(
      path.join(source.directory, "dist/lensdesk.tool.json"),
      JSON.stringify(source.manifest),
    );
    const wrong = generateKeyPair();
    await expect(
      prepareToolRelease(source, path.join(root, "wrong"), {
        privateKeyPem: wrong.privateKeyPem,
        publicKeyPem: keys.publicKeyPem,
      }),
    ).rejects.toThrow();
  });

  it("rechaza bytes alterados de metadata, suma o paquete antes de publicar", async () => {
    const { root, source, keys } = await fixture();
    const out = path.join(root, "out");
    const bundle = await prepareToolRelease(source, out, keys);
    for (let index = 0; index < 3; index++) {
      const changed = structuredClone(bundle);
      changed.files[index]?.bytes.fill(0);
      expect(() => assertToolReleaseBundle(changed)).toThrow();
    }
    const metadataFile = path.join(out, "tool-release.json");
    await fs.writeFile(metadataFile, JSON.stringify({ ...bundle.metadata, apiVersion: 2 }));
    await expect(loadToolRelease(source, out, keys.publicKeyPem)).rejects.toThrow(/Metadata/);
  });
});
