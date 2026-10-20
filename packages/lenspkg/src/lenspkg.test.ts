import { spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import yazl from "yazl";
import { canonicalPayload, sha256 } from "./canonical.ts";
import { extractPackage, generateKeyPair, packTool, verifyPackage } from "./index.ts";
import { signFiles } from "./keys.ts";

const roots: string[] = [];
async function temp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lenspkg-"));
  roots.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
const manifest = {
  id: "sample-tool",
  name: { es: "Muestra", en: "Sample" },
  description: { es: "Demo", en: "Demo" },
  version: "1.2.3",
  apiVersion: 1,
  icon: "Box",
  ui: { entry: "ui/index.html" },
  permissions: [],
  minHostVersion: "0.1.0",
};
async function source(dir: string, changes: Record<string, unknown> = {}) {
  await mkdir(path.join(dir, "ui"), { recursive: true });
  await writeFile(
    path.join(dir, "lensdesk.tool.json"),
    JSON.stringify({ ...manifest, ...changes }),
  );
  await writeFile(path.join(dir, "ui/index.html"), "<h1>ok</h1>");
}
async function zip(
  out: string,
  entries: Array<{ name: string; data?: string | Buffer; mode?: number; compress?: boolean }>,
) {
  const archive = new yazl.ZipFile();
  const substitutions: Array<[Buffer, Buffer]> = [];
  for (const entry of entries) {
    const actual = Buffer.from(entry.name);
    const safe = Buffer.from("x".repeat(actual.length));
    archive.addBuffer(
      Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? "bad"),
      safe.toString(),
      {
        mode: entry.mode,
        compress: entry.compress,
      },
    );
    substitutions.push([safe, actual]);
  }
  await new Promise<void>((resolve, reject) => {
    archive.outputStream.pipe(createWriteStream(out)).on("close", resolve).on("error", reject);
    archive.outputStream.on("error", reject);
    archive.end();
  });
  let bytes = await readFile(out);
  for (const [safe, actual] of substitutions) {
    let at = 0;
    for (let count = 0; count < 2; count++) {
      const found = bytes.indexOf(safe, at);
      if (found < 0) break;
      bytes = Buffer.concat([
        bytes.subarray(0, found),
        actual,
        bytes.subarray(found + safe.length),
      ]);
      at = found + actual.length;
    }
  }
  await writeFile(out, bytes);
}
describe("@lensdesk/lenspkg", () => {
  it("rechaza bytes aleatorios y un zip truncado con E_PACKAGE_INVALID", async () => {
    const dir = await temp();
    const file = path.join(dir, "damaged.lenspkg");
    await writeFile(file, Buffer.from([17, 91, 0, 212, 38, 119]));
    expect(await verifyPackage(file)).toMatchObject({ ok: false, code: "E_PACKAGE_INVALID" });
    await zip(file, [{ name: "ui/index.html", data: "content" }]);
    const bytes = await readFile(file);
    await writeFile(file, bytes.subarray(0, bytes.length - 12));
    expect(await verifyPackage(file)).toMatchObject({ ok: false, code: "E_PACKAGE_INVALID" });
    await expect(extractPackage(file, path.join(dir, "extracted"))).rejects.toMatchObject({
      code: "E_PACKAGE_INVALID",
    });
  });
  it("ordena rutas por unidades de código al firmar y verifica archivos B y a", async () => {
    const dir = await temp();
    await source(dir);
    await writeFile(path.join(dir, "ui/B.js"), "B");
    await writeFile(path.join(dir, "ui/a.js"), "a");
    const pair = generateKeyPair();
    const out = path.join(dir, "mixed-case.lenspkg");
    await packTool(dir, { outFile: out, signing: { ...pair, keyId: "test" } });
    const files = [
      { path: "ui/B.js", sha256: sha256("B") },
      { path: "ui/a.js", sha256: sha256("a") },
    ];
    const payload = JSON.parse(canonicalPayload("test", files).toString("utf8"));
    expect(payload.files.map((file: { path: string }) => file.path)).toEqual([
      "ui/B.js",
      "ui/a.js",
    ]);
    const result = await verifyPackage(out, { trustedKeys: { test: pair.publicKeyPem } });
    expect(result, JSON.stringify(result)).toMatchObject({
      ok: true,
      signed: true,
    });
  });
  it("verifica paquete legítimo con PK\\x01\\x02 dentro de un archivo UI", async () => {
    const dir = await temp();
    const pair = generateKeyPair();
    const manifestText = JSON.stringify(manifest);
    const payload = Buffer.from([0x41, 0x50, 0x4b, 0x01, 0x02, 0x42]);
    const files = [
      { path: "lensdesk.tool.json", sha256: sha256(manifestText) },
      { path: "ui/pk.bin", sha256: sha256(payload) },
    ];
    const signature = {
      algorithm: "ed25519",
      keyId: "test",
      files,
      signature: signFiles("test", files, pair.privateKeyPem),
    };
    const out = path.join(dir, "pk-data.lenspkg");
    const archive = new yazl.ZipFile();
    archive.addBuffer(Buffer.from(manifestText), "lensdesk.tool.json");
    archive.addBuffer(payload, "ui/pk.bin", { compress: false });
    archive.addBuffer(Buffer.from(JSON.stringify(signature)), "signature.json");
    await new Promise<void>((resolve, reject) => {
      archive.outputStream.pipe(createWriteStream(out)).on("close", resolve).on("error", reject);
      archive.outputStream.on("error", reject);
      archive.end();
    });
    const result = await verifyPackage(out, { trustedKeys: { test: pair.publicKeyPem } });
    expect(result, JSON.stringify(result)).toMatchObject({
      ok: true,
      signed: true,
    });
  });
  it("rechaza firma hecha con otra clave aunque keyId sea de confianza", async () => {
    const dir = await temp();
    await source(dir);
    const trusted = generateKeyPair();
    const other = generateKeyPair();
    const out = path.join(dir, "wrong-key.lenspkg");
    await packTool(dir, {
      outFile: out,
      signing: { privateKeyPem: other.privateKeyPem, keyId: "trusted-id" },
    });
    expect(
      await verifyPackage(out, { trustedKeys: { "trusted-id": trusted.publicKeyPem } }),
    ).toMatchObject({ ok: false, code: "E_SIGNATURE_INVALID" });
  });
  it("rechaza lista de hashes cambiada después de firmar", async () => {
    const dir = await temp();
    const pair = generateKeyPair();
    const manifestText = JSON.stringify(manifest);
    const html = "<h1>ok</h1>";
    const files = [
      { path: "lensdesk.tool.json", sha256: sha256(manifestText) },
      { path: "ui/index.html", sha256: sha256(html) },
    ];
    const signature = {
      algorithm: "ed25519",
      keyId: "test",
      files: files.map((file) =>
        file.path === "ui/index.html" ? { ...file, sha256: "0".repeat(64) } : file,
      ),
      signature: signFiles("test", files, pair.privateKeyPem),
    };
    const out = path.join(dir, "changed-hash.lenspkg");
    await zip(out, [
      { name: "lensdesk.tool.json", data: manifestText },
      { name: "ui/index.html", data: html },
      { name: "signature.json", data: JSON.stringify(signature) },
    ]);
    expect(await verifyPackage(out, { trustedKeys: { test: pair.publicKeyPem } })).toMatchObject({
      ok: false,
      code: "E_SIGNATURE_INVALID",
    });
  });
  it.each(["missing", "unlisted"])(
    "rechaza archivo %s frente a la lista firmada",
    async (caseName) => {
      const dir = await temp();
      const pair = generateKeyPair();
      const manifestText = JSON.stringify(manifest);
      const html = "<h1>ok</h1>";
      const listed = [{ path: "lensdesk.tool.json", sha256: sha256(manifestText) }];
      const actualEntries = [{ name: "lensdesk.tool.json", data: manifestText }];
      if (caseName === "missing") listed.push({ path: "ui/index.html", sha256: sha256(html) });
      else actualEntries.push({ name: "ui/index.html", data: html });
      const signatureFiles = listed;
      const signature = {
        algorithm: "ed25519",
        keyId: "test",
        files: signatureFiles,
        signature: signFiles("test", signatureFiles, pair.privateKeyPem),
      };
      const file = path.join(dir, "set.lenspkg");
      await zip(file, [
        ...actualEntries,
        { name: "signature.json", data: JSON.stringify(signature) },
      ]);
      expect(await verifyPackage(file, { trustedKeys: { test: pair.publicKeyPem } })).toMatchObject(
        {
          ok: false,
          code: "E_HASH_MISMATCH",
        },
      );
    },
  );
  it("firma JSON canónico y crea un paquete verificable", async () => {
    const dir = await temp();
    await source(dir);
    const pair = generateKeyPair();
    const out = path.join(dir, "good.lenspkg");
    await packTool(dir, { outFile: out, signing: { ...pair, keyId: "test" } });
    const result = await verifyPackage(out, {
      trustedKeys: { test: pair.publicKeyPem },
      hostVersion: "1.0.0",
    });
    expect(result.ok && result.signed).toBe(true);
  });
  it.each([
    ["alterado", "E_HASH_MISMATCH", async () => {}],
    ["firma sin confianza", "E_SIGNATURE_INVALID", async () => {}],
    [
      "sin firma",
      "E_UNSIGNED",
      async (_d: string, out: string) => {
        const dir = path.dirname(out);
        await packTool(dir, { outFile: out, signing: null });
      },
    ],
    [
      "manifiesto inválido",
      "E_MANIFEST_INVALID",
      async (d: string) => {
        await source(d, { id: "BAD" });
      },
    ],
    [
      "api no soportada",
      "E_API_VERSION_UNSUPPORTED",
      async (d: string) => {
        await source(d, { apiVersion: 99 });
      },
    ],
    ["host antiguo", "E_HOST_TOO_OLD", async () => {}],
  ])("verify devuelve %s (%s)", async (label, code, prepare) => {
    const dir = await temp();
    await source(dir);
    const pair = generateKeyPair();
    const out = path.join(dir, "test.lenspkg");
    await packTool(dir, {
      outFile: out,
      signing:
        label === "sin firma"
          ? null
          : {
              privateKeyPem: pair.privateKeyPem,
              keyId: label === "firma sin confianza" ? "unknown" : "test",
            },
    });
    await prepare(dir, out);
    if (label === "alterado") {
      const signatureFiles = [
        { path: "lensdesk.tool.json", sha256: sha256(JSON.stringify(manifest)) },
        { path: "ui/index.html", sha256: sha256("<h1>ok</h1>") },
      ];
      const signature = {
        algorithm: "ed25519",
        keyId: "test",
        files: signatureFiles,
        signature: signFiles("test", signatureFiles, pair.privateKeyPem),
      };
      await zip(path.join(dir, "altered.lenspkg"), [
        { name: "lensdesk.tool.json", data: JSON.stringify(manifest) },
        { name: "ui/index.html", data: "changed content" },
        { name: "signature.json", data: JSON.stringify(signature) },
      ]);
    }
    if (label === "manifiesto inválido" || label === "api no soportada") {
      await packTool(dir, {
        outFile: out,
        signing: { privateKeyPem: pair.privateKeyPem, keyId: "test" },
      });
    }
    const options =
      label === "host antiguo"
        ? { trustedKeys: { test: pair.publicKeyPem }, hostVersion: "0.0.1" }
        : label === "firma sin confianza"
          ? {}
          : { trustedKeys: { test: pair.publicKeyPem } };
    const result = await verifyPackage(
      label === "alterado" ? path.join(dir, "altered.lenspkg") : out,
      options,
    );
    expect(result).toMatchObject({ ok: false, code });
  });
  it("allowUntrusted solo degrada firma inválida o ausente, no hashes", async () => {
    const dir = await temp();
    await source(dir);
    const pair = generateKeyPair();
    const out = path.join(dir, "x.lenspkg");
    await packTool(dir, { outFile: out, signing: { ...pair, keyId: "k" } });
    expect(await verifyPackage(out, { allowUntrusted: true })).toMatchObject({
      ok: true,
      signed: false,
    });
    await writeFile(path.join(dir, "ui/index.html"), "tampered");
    await packTool(dir, { outFile: out, signing: { ...pair, keyId: "k" } });
    const unsigned = path.join(dir, "unsigned.lenspkg");
    await packTool(dir, { outFile: unsigned, signing: null });
    expect(await verifyPackage(unsigned, { allowUntrusted: true })).toMatchObject({
      ok: true,
      signed: false,
    });
    const mutated = path.join(dir, "mutated.lenspkg");
    await zip(mutated, [
      { name: "lensdesk.tool.json", data: JSON.stringify(manifest) },
      { name: "ui/index.html", data: "x" },
      {
        name: "signature.json",
        data: JSON.stringify({
          algorithm: "ed25519",
          keyId: "k",
          files: [{ path: "ui/index.html", sha256: "0".repeat(64) }],
          signature: "AA==",
        }),
      },
    ]);
    expect(await verifyPackage(mutated, { allowUntrusted: true })).toMatchObject({
      ok: false,
      code: "E_HASH_MISMATCH",
    });
  });
  it.each(["/absolute", "../escape", "C:/drive", "ui\\backslash", "link"])(
    "rejects malicious zip path %s without writing outside destination",
    async (name) => {
      const dir = await temp();
      const dest = path.join(dir, "dest");
      await mkdir(dest);
      const out = path.join(dir, "malicious.zip");
      await zip(out, [{ name, data: "pwned", mode: name === "link" ? 0o120777 : 0o100644 }]);
      await expect(extractPackage(out, dest)).rejects.toMatchObject({ code: "E_ZIP_UNSAFE_PATH" });
      expect(await readdir(dir)).toEqual(["dest", "malicious.zip"]);
    },
  );
  it.each([
    [{ entries: 1 }, "E_TOO_LARGE"],
    [{ uncompressedBytes: 1 }, "E_TOO_LARGE"],
    [{ compressedBytes: 1 }, "E_TOO_LARGE"],
  ])("aplica límites inyectados", async (limits, code) => {
    const dir = await temp();
    await source(dir);
    const out = path.join(dir, "x.lenspkg");
    await packTool(dir, { outFile: out, signing: null });
    expect(await verifyPackage(out, { allowUntrusted: true, limits })).toMatchObject({
      ok: false,
      code,
    });
  });
  it("CLI ejecuta versión, uso, verify, keygen idempotente y salida de pack", async () => {
    const cli = path.resolve("packages/lenspkg/src/cli.ts");
    const dir = await temp();
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
    expect(run("--version").status).toBe(0);
    expect(run("frobnicate").status).toBe(2);
    const bad = path.join(dir, "bad.zip");
    await zip(bad, [{ name: "x" }]);
    expect(run("verify", bad).status).toBe(1);
    expect(run("verify", bad).stderr).toContain("E_UNSIGNED");
    const keys = path.join(dir, "keys");
    expect(run("keygen", "--out", keys, "--key-id", "discard").status).toBe(0);
    const before = await readFile(path.join(keys, "discard.pem"));
    expect(run("keygen", "--out", keys, "--key-id", "discard").status).toBe(0);
    expect(await readFile(path.join(keys, "discard.pem"))).toEqual(before);
    const tool = path.join(dir, "tool");
    await source(tool);
    expect(run("pack", tool, "--out", `${dir}/out/`, "--unsigned").status).toBe(0);
    expect((await stat(path.join(dir, "out/sample-tool-1.2.3.lenspkg"))).isFile()).toBe(true);
  });
});
