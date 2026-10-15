#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../package.json" with { type: "json" };
import { generateKeyPair, inspectPackage, packTool, verifyPackage } from "./index.ts";

const args = process.argv.slice(2);
function value(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i < 0 ? undefined : args[i + 1];
}
async function run(): Promise<number> {
  const command = args[0];
  if (command === "--version") {
    console.log(pkg.version);
    return 0;
  }
  if (command === "keygen") {
    const out = value("--out");
    const keyId = value("--key-id");
    if (!out || !keyId) return 2;
    await fs.mkdir(out, { recursive: true });
    const privatePath = path.join(out, `${keyId}.pem`);
    const publicPath = path.join(out, `${keyId}.pub`);
    try {
      await fs.access(privatePath);
      await fs.access(publicPath);
      return 0;
    } catch {}
    const keys = generateKeyPair();
    await fs.writeFile(privatePath, keys.privateKeyPem, { mode: 0o600, flag: "wx" });
    await fs.writeFile(publicPath, keys.publicKeyPem, { mode: 0o644, flag: "wx" });
    return 0;
  }
  if (command === "pack") {
    const toolDir = args[1];
    const outArg = value("--out");
    if (!toolDir || !outArg || args.includes("--key") === args.includes("--unsigned")) return 2;
    const manifest = JSON.parse(
      await fs.readFile(path.join(toolDir, "lensdesk.tool.json"), "utf8"),
    );
    const keyPath = value("--key");
    const signing = keyPath
      ? {
          privateKeyPem: await fs.readFile(keyPath, "utf8"),
          keyId: value("--key-id") ?? path.basename(keyPath).replace(/\.pem$/, ""),
        }
      : null;
    const isDir =
      outArg.endsWith("/") ||
      (await fs
        .stat(outArg)
        .then((s) => s.isDirectory())
        .catch(() => false));
    const outFile = isDir
      ? path.join(outArg, `${manifest.id}-${manifest.version}.lenspkg`)
      : outArg;
    await packTool(toolDir, { outFile, signing });
    return 0;
  }
  if (command === "verify") {
    const file = args[1];
    const pub = value("--pub");
    if (!file) return 2;
    const keys = pub
      ? { [path.basename(pub).replace(/\.pub$/, "")]: await fs.readFile(pub, "utf8") }
      : {};
    const result = await verifyPackage(file, { trustedKeys: keys });
    if (!result.ok) {
      console.error(result.code, result.message);
      return 1;
    }
    console.log(
      JSON.stringify({
        id: result.manifest.id,
        version: result.manifest.version,
        signed: result.signed,
        keyId: result.keyId,
      }),
    );
    return 0;
  }
  if (command === "inspect") {
    if (!args[1]) return 2;
    console.log(JSON.stringify(await inspectPackage(args[1]), null, 2));
    return 0;
  }
  console.error(`Unknown command: ${command ?? ""}`);
  return 2;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(
        error instanceof Error && "code" in error ? String(error.code) : "E_INTERNAL",
        error instanceof Error ? error.message : String(error),
      );
      process.exitCode = 1;
    });
}
