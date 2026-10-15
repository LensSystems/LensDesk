import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolManifest } from "@lensdesk/sdk";
import {
  LensError,
  MANIFEST_FILENAME,
  SUPPORTED_API_VERSIONS,
  toolManifestSchema,
} from "@lensdesk/sdk";
import semver from "semver";
import yauzl from "yauzl";
import { compareCodeUnits, type PackageFile } from "./canonical.ts";
import { assertInside, safeEntryPath } from "./extract.ts";
import { verifySignature } from "./keys.ts";

export type Limits = { compressedBytes: number; uncompressedBytes: number; entries: number };
export const DEFAULT_LIMITS: Limits = {
  compressedBytes: 100 * 1024 * 1024,
  uncompressedBytes: 500 * 1024 * 1024,
  entries: 5000,
};
type EntryData = { path: string; bytes: Buffer; mode: number };
async function readEntries(file: string, limits: Limits): Promise<EntryData[]> {
  const stat = await fs.stat(file);
  if (stat.size > limits.compressedBytes)
    throw new LensError("E_TOO_LARGE", "Package exceeds compressed size limit");
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.open(file, { lazyEntries: true, decodeStrings: false }, (err, value) =>
      err || !value ? reject(err ?? new Error("Invalid zip")) : resolve(value),
    ),
  );
  return new Promise((resolve, reject) => {
    const entries: EntryData[] = [];
    let total = 0;
    zip.on("error", reject);
    zip.on("entry", (entry) => {
      if (entries.length + 1 > limits.entries) {
        zip.close();
        reject(new LensError("E_TOO_LARGE", "Package exceeds entry limit"));
        return;
      }
      let entryPath: string;
      try {
        entryPath = Buffer.isBuffer(entry.fileName)
          ? entry.fileName.toString("utf8")
          : entry.fileName;
        safeEntryPath(entryPath, entry.externalFileAttributes);
      } catch (error) {
        zip.close();
        reject(error);
        return;
      }
      total += entry.uncompressedSize;
      if (total > limits.uncompressedBytes) {
        zip.close();
        reject(new LensError("E_TOO_LARGE", "Package exceeds uncompressed size limit"));
        return;
      }
      if (/\/$/.test(entryPath)) {
        zip.readEntry();
        return;
      }
      zip.openReadStream(entry, (err, stream) => {
        if (err || !stream) {
          zip.close();
          reject(err ?? new Error("Unreadable zip entry"));
          return;
        }
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => {
          entries.push({
            path: entryPath,
            bytes: Buffer.concat(chunks),
            mode: entry.externalFileAttributes >>> 16,
          });
          zip.readEntry();
        });
      });
    });
    zip.on("end", () => resolve(entries));
    zip.readEntry();
  });
}
export type VerifyOptions = {
  trustedKeys?: Map<string, string> | Record<string, string>;
  allowUntrusted?: boolean;
  hostVersion?: string;
  limits?: Partial<Limits>;
};
export type Verification =
  | { ok: true; manifest: ToolManifest; signed: boolean; keyId: string | null }
  | { ok: false; code: string; message: string };
function fail(error: unknown): Verification {
  return {
    ok: false,
    code: error instanceof LensError ? error.code : "E_INTERNAL",
    message: error instanceof Error ? error.message : "Package verification failed",
  };
}
export async function verifyPackage(
  file: string,
  options: VerifyOptions = {},
): Promise<Verification> {
  try {
    const limits = { ...DEFAULT_LIMITS, ...options.limits };
    const entries = await readEntries(file, limits);
    const byPath = new Map(entries.map((entry) => [entry.path, entry.bytes]));
    const signatureBytes = byPath.get("signature.json");
    let keyId: string | null = null;
    let signed = false;
    if (!signatureBytes) {
      if (!options.allowUntrusted) throw new LensError("E_UNSIGNED", "Package is unsigned");
    } else {
      let signature: {
        algorithm?: string;
        keyId?: string;
        files?: PackageFile[];
        signature?: string;
      };
      try {
        signature = JSON.parse(signatureBytes.toString("utf8"));
      } catch {
        throw new LensError("E_SIGNATURE_INVALID", "Invalid signature document");
      }
      keyId = signature.keyId ?? null;
      if (
        signature.algorithm !== "ed25519" ||
        !keyId ||
        !Array.isArray(signature.files) ||
        !signature.signature
      )
        throw new LensError("E_SIGNATURE_INVALID", "Invalid signature document");
      const keys = options.trustedKeys;
      const publicKey = keys instanceof Map ? keys.get(keyId) : keys?.[keyId];
      if (!publicKey || !verifySignature(keyId, signature.files, signature.signature, publicKey)) {
        if (!options.allowUntrusted)
          throw new LensError("E_SIGNATURE_INVALID", "Signature is not trusted or invalid");
      } else signed = true;
      const actual = entries
        .filter((entry) => entry.path !== "signature.json")
        .map(({ path: entryPath, bytes }) => ({
          path: entryPath,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        }))
        .sort((a, b) => compareCodeUnits(a.path, b.path));
      const listed = [...signature.files].sort((a, b) => compareCodeUnits(a.path, b.path));
      if (JSON.stringify(actual) !== JSON.stringify(listed))
        throw new LensError("E_HASH_MISMATCH", "Package files do not match signature hashes");
    }
    const manifestBytes = byPath.get(MANIFEST_FILENAME);
    if (!manifestBytes) throw new LensError("E_MANIFEST_INVALID", "Manifest is missing");
    let raw: unknown;
    try {
      raw = JSON.parse(manifestBytes.toString("utf8"));
    } catch {
      throw new LensError("E_MANIFEST_INVALID", "Manifest is invalid JSON");
    }
    const parsed = toolManifestSchema.safeParse(raw);
    if (!parsed.success) throw new LensError("E_MANIFEST_INVALID", "Manifest is invalid");
    if (!(SUPPORTED_API_VERSIONS as readonly number[]).includes(parsed.data.apiVersion))
      throw new LensError("E_API_VERSION_UNSUPPORTED", "Unsupported API version");
    if (options.hostVersion && semver.gt(parsed.data.minHostVersion, options.hostVersion))
      throw new LensError("E_HOST_TOO_OLD", "Host version is too old");
    return { ok: true, manifest: parsed.data, signed, keyId };
  } catch (error) {
    return fail(error);
  }
}
export async function inspectPackage(
  file: string,
): Promise<{ manifest: ToolManifest; signed: boolean; keyId: string | null; files: string[] }> {
  const verified = await verifyPackage(file, { allowUntrusted: true });
  if (
    !verified.ok &&
    verified.code !== "E_HASH_MISMATCH" &&
    verified.code !== "E_SIGNATURE_INVALID"
  )
    throw new LensError(verified.code as never, verified.message);
  const zipEntries = await readEntries(file, DEFAULT_LIMITS);
  const manifestEntry = zipEntries.find((entry) => entry.path === MANIFEST_FILENAME);
  if (!manifestEntry) throw new LensError("E_MANIFEST_INVALID", "Manifest is missing");
  const manifest = toolManifestSchema.parse(JSON.parse(manifestEntry.bytes.toString("utf8")));
  return {
    manifest,
    signed: verified.ok && verified.signed,
    keyId: verified.ok ? verified.keyId : null,
    files: zipEntries.map((entry) => entry.path),
  };
}
export async function extractPackage(file: string, destDir: string): Promise<void> {
  const entries = await readEntries(file, DEFAULT_LIMITS);
  for (const entry of entries) {
    const target = assertInside(destDir, safeEntryPath(entry.path, entry.mode << 16));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, entry.bytes, { flag: "wx" });
  }
}
