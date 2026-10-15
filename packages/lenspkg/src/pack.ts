import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { MANIFEST_FILENAME } from "@lensdesk/sdk";
import yazl from "yazl";
import { compareCodeUnits, type PackageFile, sha256 } from "./canonical.ts";
import { signFiles } from "./keys.ts";

export async function zipDirectory(dir: string, outFile: string): Promise<void> {
  const zip = new yazl.ZipFile();
  const done = new Promise<void>((resolve, reject) => {
    zip.outputStream.pipe(createWriteStream(outFile)).on("close", resolve).on("error", reject);
    zip.outputStream.on("error", reject);
  });
  const walk = async (base: string, rel = ""): Promise<void> => {
    for (const item of await fs.readdir(path.join(base, rel), { withFileTypes: true })) {
      const name = path.posix.join(rel, item.name);
      if (item.isDirectory()) await walk(base, name);
      else if (item.isFile()) zip.addFile(path.join(base, name), name);
    }
  };
  await walk(dir);
  zip.end();
  await done;
}

export async function packTool(
  toolDir: string,
  options: { outFile: string; signing: { privateKeyPem: string; keyId: string } | null },
): Promise<void> {
  const paths: string[] = [];
  const walk = async (rel = ""): Promise<void> => {
    for (const item of await fs.readdir(path.join(toolDir, rel), { withFileTypes: true })) {
      const name = path.posix.join(rel, item.name);
      if (item.isDirectory()) {
        if (
          name === "ui" ||
          name === "backend" ||
          name.startsWith("ui/") ||
          name.startsWith("backend/")
        )
          await walk(name);
      } else if (
        item.isFile() &&
        (name === MANIFEST_FILENAME || name.startsWith("ui/") || name.startsWith("backend/"))
      )
        paths.push(name);
    }
  };
  await walk();
  const files: PackageFile[] = await Promise.all(
    paths.map(async (p) => ({ path: p, sha256: sha256(await fs.readFile(path.join(toolDir, p))) })),
  );
  files.sort((a, b) => compareCodeUnits(a.path, b.path));
  const zip = new yazl.ZipFile();
  for (const file of files) zip.addFile(path.join(toolDir, file.path), file.path);
  if (options.signing) {
    const signature = {
      algorithm: "ed25519",
      keyId: options.signing.keyId,
      files,
      signature: signFiles(options.signing.keyId, files, options.signing.privateKeyPem),
    };
    zip.addBuffer(Buffer.from(JSON.stringify(signature), "utf8"), "signature.json");
  }
  await fs.mkdir(path.dirname(path.resolve(options.outFile)), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    zip.outputStream
      .pipe(createWriteStream(options.outFile))
      .on("close", resolve)
      .on("error", reject);
    zip.outputStream.on("error", reject);
    zip.end();
  });
}
