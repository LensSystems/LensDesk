import { createHash } from "node:crypto";

export type PackageFile = { path: string; sha256: string };
export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
export function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
export function canonicalPayload(keyId: string, files: PackageFile[]): Buffer {
  const ordered = [...files]
    .sort((a, b) => compareCodeUnits(a.path, b.path))
    .map(({ path, sha256: hash }) => ({ path, sha256: hash }));
  return Buffer.from(JSON.stringify({ keyId, files: ordered }), "utf8");
}
