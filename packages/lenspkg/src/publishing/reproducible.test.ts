import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPair } from "../keys.ts";
import { packTool } from "../pack.ts";
import { verifyPackage } from "../verify.ts";
import { prepareToolRelease, type ToolReleaseBundle } from "./artifacts.ts";
import { publishToolRelease, type RemoteToolRelease, type ToolReleaseClient } from "./publish.ts";
import { resolveToolRelease } from "./source.ts";
import { fixtureTool, temporaryTools } from "./test-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
async function setFileMetadata(directory: string, date: Date, mode: number) {
  for (const name of ["lensdesk.tool.json", "ui/index.html"]) {
    const file = path.join(directory, name);
    await fs.utimes(file, date, date);
    await fs.chmod(file, mode);
  }
}

function remote(bundle: ToolReleaseBundle, draft: boolean) {
  const commit = "a".repeat(40);
  let release: RemoteToolRelease = {
    id: 42,
    tag_name: bundle.metadata.releaseTag,
    target_commitish: commit,
    draft,
    prerelease: false,
  };
  const assets = bundle.files.slice(0, draft ? 1 : 3).map((file, i) => ({
    id: i + 1,
    name: file.name,
    bytes: file.bytes,
    size: file.bytes.length,
    state: "uploaded",
  }));
  const client: ToolReleaseClient = {
    assertTagCommit: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(async () => release),
    createDraft: vi.fn().mockRejectedValue(Error("Existing release must not be replaced")),
    listAssets: vi.fn(async () => assets),
    downloadAsset: vi.fn(async (id) => {
      const asset = assets.find((value) => value.id === id);
      if (!asset) throw Error("Missing fixture asset");
      return asset.bytes;
    }),
    uploadAsset: vi.fn(async (_id, file) => {
      assets.push({
        id: assets.length + 1,
        name: file.name,
        bytes: file.bytes,
        size: file.bytes.length,
        state: "uploaded",
      });
    }),
    publish: vi.fn(async () => {
      release = { ...release, draft: false };
      return release;
    }),
  };
  return { client, commit };
}

describe("reconstrucción reproducible de publicaciones", () => {
  it("reconstruye los mismos bytes con otro reloj/mtime y reanuda drafts o públicas existentes", async () => {
    const root = await temporaryTools();
    roots.push(root);
    const { directory } = await fixtureTool(root, "notes");
    const source = await resolveToolRelease(root, "notes-v1.2.3");
    const keys = generateKeyPair();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2025-01-02T03:04:05Z"));
    await setFileMetadata(path.join(directory, "dist"), new Date("2024-01-02T03:04:05Z"), 0o600);
    const first = await prepareToolRelease(source, path.join(root, "first"), keys);
    vi.setSystemTime(new Date("2030-06-07T08:09:10Z"));
    await setFileMetadata(path.join(directory, "dist"), new Date("2029-06-07T08:09:10Z"), 0o644);
    const second = await prepareToolRelease(source, path.join(root, "second"), keys);
    expect(second.metadata).toEqual(first.metadata);
    expect(second.files.map((file) => ({ name: file.name, bytes: [...file.bytes] }))).toEqual(
      first.files.map((file) => ({ name: file.name, bytes: [...file.bytes] })),
    );
    for (const output of ["first", "second"])
      expect(
        (
          await verifyPackage(path.join(root, output, first.metadata.asset.name), {
            trustedKeys: { release: keys.publicKeyPem },
          })
        ).ok,
      ).toBe(true);
    const partial = remote(first, true);
    expect(
      (await publishToolRelease(second, partial.commit, partial.client)).alreadyPublished,
    ).toBe(false);
    expect(partial.client.uploadAsset).toHaveBeenCalledTimes(2);
    expect(partial.client.createDraft).not.toHaveBeenCalled();
    const published = remote(first, false);
    expect(
      (await publishToolRelease(second, published.commit, published.client)).alreadyPublished,
    ).toBe(true);
    expect(published.client.uploadAsset).not.toHaveBeenCalled();
    expect(published.client.publish).not.toHaveBeenCalled();
    await fs.writeFile(path.join(directory, "dist/ui/index.html"), "<h1>Contenido diferente</h1>");
    const changed = await prepareToolRelease(source, path.join(root, "changed"), keys);
    expect(changed.metadata.asset.sha256).not.toBe(first.metadata.asset.sha256);
    const conflict = remote(first, false);
    await expect(publishToolRelease(changed, conflict.commit, conflict.client)).rejects.toThrow(
      /conflicting|conflict/,
    );
    expect(conflict.client.uploadAsset).not.toHaveBeenCalled();
    expect(conflict.client.publish).not.toHaveBeenCalled();
  });

  it("conserva el comportamiento anterior de packTool cuando no se solicita reproducibilidad", async () => {
    const root = await temporaryTools();
    roots.push(root);
    const { directory } = await fixtureTool(root, "notes");
    const dist = path.join(directory, "dist");
    const first = path.join(root, "default-first.lenspkg"),
      second = path.join(root, "default-second.lenspkg");
    await setFileMetadata(dist, new Date("2024-01-02T03:04:05Z"), 0o644);
    await packTool(dist, { outFile: first, signing: null });
    await setFileMetadata(dist, new Date("2029-06-07T08:09:10Z"), 0o644);
    await packTool(dist, { outFile: second, signing: null });
    expect(await fs.readFile(first)).not.toEqual(await fs.readFile(second));
  });
});
