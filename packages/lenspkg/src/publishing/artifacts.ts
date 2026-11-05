import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { toolManifestSchema } from "@lensdesk/sdk";
import {
  OFFICIAL_TOOLS_REPOSITORY,
  TOOL_CATALOG_LIMITS,
  type ToolReleaseMetadata,
  toolReleaseMetadataSchema,
} from "../catalog/contract.ts";
import { packTool } from "../pack.ts";
import { verifyPackage } from "../verify.ts";
import { ToolReleaseError } from "./error.ts";
import { parseToolReleaseTag, type ToolReleaseSource } from "./source.ts";

export type ToolReleaseFile = { name: string; bytes: Uint8Array };
export type ToolReleaseBundle = { metadata: ToolReleaseMetadata; files: ToolReleaseFile[] };
export const releaseSha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export async function verifyReleasePackage(
  file: string,
  source: ToolReleaseSource,
  publicKey: string,
): Promise<ToolReleaseMetadata> {
  const result = await verifyPackage(file, { trustedKeys: { release: publicKey } });
  if (
    !result.ok ||
    !result.signed ||
    result.keyId !== "release" ||
    JSON.stringify(result.manifest) !== JSON.stringify(toolManifestSchema.parse(source.manifest))
  )
    throw new ToolReleaseError("Signed package does not match its source manifest");
  const bytes = await fs.readFile(file);
  const { id, version, apiVersion, minHostVersion } = result.manifest;
  const root = `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases`;
  const name = `${id}-${version}.lenspkg`;
  return toolReleaseMetadataSchema.parse({
    schemaVersion: 1,
    repository: OFFICIAL_TOOLS_REPOSITORY,
    id,
    version,
    apiVersion,
    minHostVersion,
    releaseTag: source.tag,
    asset: {
      name,
      url: `${root}/download/${source.tag}/${name}`,
      size: bytes.length,
      sha256: releaseSha256(bytes),
    },
    notesUrl: `${root}/tag/${source.tag}`,
  });
}

function checksums(files: ToolReleaseFile[]): string {
  return `${files
    .map((item) => `${releaseSha256(item.bytes)}  ${item.name}`)
    .sort()
    .join("\n")}\n`;
}

export function assertToolReleaseBundle(bundle: ToolReleaseBundle): void {
  const metadata = toolReleaseMetadataSchema.parse(bundle.metadata);
  const expected = [metadata.asset.name, "tool-release.json", "SHA256SUMS.txt"];
  if (bundle.files.length !== 3 || new Set(bundle.files.map((file) => file.name)).size !== 3)
    throw new ToolReleaseError("Release must contain exactly three distinct assets");
  const files = expected.map((name) => bundle.files.find((file) => file.name === name));
  const [packageFile, metadataFile, checksumFile] = files;
  if (
    !packageFile ||
    !metadataFile ||
    !checksumFile ||
    packageFile.bytes.length !== metadata.asset.size ||
    releaseSha256(packageFile.bytes) !== metadata.asset.sha256 ||
    metadataFile.bytes.length > TOOL_CATALOG_LIMITS.metadataBytes ||
    checksumFile.bytes.length > TOOL_CATALOG_LIMITS.metadataBytes ||
    new TextDecoder().decode(metadataFile.bytes) !== `${JSON.stringify(metadata, null, 2)}\n` ||
    new TextDecoder().decode(checksumFile.bytes) !== checksums([packageFile, metadataFile])
  )
    throw new ToolReleaseError("Release bytes, metadata or checksums conflict");
}

async function assertBuildFiles(source: ToolReleaseSource): Promise<void> {
  const dist = path.join(source.directory, "dist");
  const required = ["lensdesk.tool.json", "ui/index.html"];
  if (source.manifest.backend) required.push(source.manifest.backend.entry);
  for (const name of required) {
    const file = path.join(dist, name);
    if ((await fs.realpath(file)) !== file || !(await fs.stat(file)).isFile())
      throw new ToolReleaseError("Built entry is missing or a symlink");
  }
}

export async function prepareToolRelease(
  source: ToolReleaseSource,
  output: string,
  signing: { privateKeyPem: string; publicKeyPem: string },
): Promise<ToolReleaseBundle> {
  parseToolReleaseTag(source.tag);
  const name = `${source.manifest.id}-${source.manifest.version}.lenspkg`;
  await fs.mkdir(output, { recursive: true });
  if ((await fs.readdir(output)).length)
    throw new ToolReleaseError("Output directory must be empty");
  const file = path.join(output, name);
  await assertBuildFiles(source);
  await packTool(path.join(source.directory, "dist"), {
    outFile: file,
    signing: { privateKeyPem: signing.privateKeyPem, keyId: "release" },
    reproducible: true,
  });
  const metadata = await verifyReleasePackage(file, source, signing.publicKeyPem);
  const metadataBytes = new TextEncoder().encode(`${JSON.stringify(metadata, null, 2)}\n`);
  if (metadataBytes.length > TOOL_CATALOG_LIMITS.metadataBytes)
    throw new ToolReleaseError("Metadata exceeds size limit");
  const files: ToolReleaseFile[] = [
    { name, bytes: await fs.readFile(file) },
    { name: "tool-release.json", bytes: metadataBytes },
  ];
  const checksum = `${files
    .map((item) => `${releaseSha256(item.bytes)}  ${item.name}`)
    .sort()
    .join("\n")}\n`;
  files.push({ name: "SHA256SUMS.txt", bytes: new TextEncoder().encode(checksum) });
  for (const item of files)
    if (item.name !== name) await fs.writeFile(path.join(output, item.name), item.bytes);
  const bundle = { metadata, files };
  assertToolReleaseBundle(bundle);
  return bundle;
}

export async function loadToolRelease(
  source: ToolReleaseSource,
  output: string,
  publicKey: string,
): Promise<ToolReleaseBundle> {
  const name = `${source.manifest.id}-${source.manifest.version}.lenspkg`;
  const metadata = await verifyReleasePackage(path.join(output, name), source, publicKey);
  const names = [name, "tool-release.json", "SHA256SUMS.txt"];
  if (JSON.stringify((await fs.readdir(output)).sort()) !== JSON.stringify([...names].sort()))
    throw new ToolReleaseError("Release directory must contain exactly three expected assets");
  const files: ToolReleaseFile[] = [];
  for (const filename of names) {
    const file = path.join(output, filename);
    const limit =
      filename === name ? TOOL_CATALOG_LIMITS.packageBytes : TOOL_CATALOG_LIMITS.metadataBytes;
    if ((await fs.stat(file)).size > limit)
      throw new ToolReleaseError("Release asset exceeds size limit");
    files.push({ name: filename, bytes: await fs.readFile(file) });
  }
  if (new TextDecoder().decode(files[1]?.bytes) !== `${JSON.stringify(metadata, null, 2)}\n`)
    throw new ToolReleaseError("Metadata bytes do not match verified package");
  const sums = `${files
    .slice(0, 2)
    .map((item) => `${releaseSha256(item.bytes)}  ${item.name}`)
    .sort()
    .join("\n")}\n`;
  if (new TextDecoder().decode(files[2]?.bytes) !== sums)
    throw new ToolReleaseError("Release checksums do not match assets");
  const bundle = { metadata, files };
  assertToolReleaseBundle(bundle);
  return bundle;
}
