import path from "node:path";
import { LensError } from "@lensdesk/sdk";
import type { Entry, ZipFile } from "yauzl";

export function safeEntryPath(name: string, externalFileAttributes = 0): string {
  const unixMode = externalFileAttributes >>> 16;
  if (
    name.length === 0 ||
    name.includes("\0") ||
    name.startsWith("/") ||
    name.startsWith("\\") ||
    name.includes("\\") ||
    /^[a-zA-Z]:/.test(name) ||
    name.split("/").some((part) => part === "..") ||
    (unixMode & 0o170000) === 0o120000
  ) {
    throw new LensError("E_ZIP_UNSAFE_PATH", `Unsafe zip path: ${name}`);
  }
  return name;
}
export function assertInside(destDir: string, relative: string): string {
  const root = path.resolve(destDir);
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep))
    throw new LensError("E_ZIP_UNSAFE_PATH", "Zip path escapes destination");
  return target;
}
export type ZipEntry = Entry;
export type PackageZip = ZipFile;
