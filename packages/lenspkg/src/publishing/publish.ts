import type { ToolReleaseBundle, ToolReleaseFile } from "./artifacts.ts";
import { assertToolReleaseBundle, releaseSha256 } from "./artifacts.ts";
import { ToolReleaseError } from "./error.ts";
import { parseToolReleaseTag } from "./source.ts";

export type RemoteToolRelease = {
  id: number;
  tag_name: string;
  target_commitish: string;
  draft: boolean;
  prerelease: boolean;
};
export type RemoteToolAsset = { id: number; name: string; size: number; state: string };
export type ToolReleaseClient = {
  assertTagCommit(tag: string, commit: string): Promise<void>;
  find(tag: string): Promise<RemoteToolRelease | null>;
  createDraft(tag: string, commit: string): Promise<RemoteToolRelease>;
  listAssets(id: number): Promise<RemoteToolAsset[]>;
  downloadAsset(id: number, maximumBytes: number): Promise<Uint8Array>;
  uploadAsset(id: number, file: ToolReleaseFile): Promise<void>;
  publish(id: number): Promise<RemoteToolRelease>;
};

export async function publishToolRelease(
  bundle: ToolReleaseBundle,
  commit: string,
  client: ToolReleaseClient,
): Promise<{ release: RemoteToolRelease; alreadyPublished: boolean; catalogReleaseTag: string }> {
  assertToolReleaseBundle(bundle);
  const tag = bundle.metadata.releaseTag;
  parseToolReleaseTag(tag);
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new ToolReleaseError("Invalid release commit");
  await client.assertTagCommit(tag, commit);
  let release = await client.find(tag);
  if (!release) release = await client.createDraft(tag, commit);
  const assertIdentity = (value: RemoteToolRelease) => {
    // target_commitish es informativo cuando el tag existe; su SHA real se verifica por ref.
    if (value.tag_name !== tag || value.prerelease)
      throw new ToolReleaseError("Existing release identity conflicts with the selected source");
  };
  assertIdentity(release);
  const expected = new Map(bundle.files.map((file) => [file.name, file]));
  async function verifyAssets(requireComplete: boolean): Promise<Set<string>> {
    const seen = new Set<string>();
    for (const asset of await client.listAssets(release?.id ?? 0)) {
      const file = expected.get(asset.name);
      if (
        !file ||
        seen.has(asset.name) ||
        asset.state !== "uploaded" ||
        asset.size !== file.bytes.length
      )
        throw new ToolReleaseError("Remote release contains unexpected or conflicting assets");
      const bytes = await client.downloadAsset(asset.id, file.bytes.length);
      if (bytes.length !== file.bytes.length || releaseSha256(bytes) !== releaseSha256(file.bytes))
        throw new ToolReleaseError("Remote release asset bytes conflict with local artifacts");
      seen.add(asset.name);
    }
    if (requireComplete && seen.size !== expected.size)
      throw new ToolReleaseError("Published release is incomplete");
    return seen;
  }
  const alreadyPublished = !release.draft;
  const uploaded = await verifyAssets(alreadyPublished);
  if (!alreadyPublished) {
    for (const file of bundle.files)
      if (!uploaded.has(file.name)) await client.uploadAsset(release.id, file);
    await verifyAssets(true);
    await client.assertTagCommit(tag, commit);
    release = await client.publish(release.id);
    assertIdentity(release);
    if (release.draft) throw new ToolReleaseError("Release remained a draft after publication");
  }
  await client.assertTagCommit(tag, commit);
  return { release, alreadyPublished, catalogReleaseTag: tag };
}
