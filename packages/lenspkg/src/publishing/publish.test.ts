import { describe, expect, it, vi } from "vitest";
import { OFFICIAL_TOOLS_REPOSITORY } from "../catalog/contract.ts";
import type { ToolReleaseBundle } from "./artifacts.ts";
import { releaseSha256 } from "./artifacts.ts";
import { publishToolRelease, type RemoteToolRelease, type ToolReleaseClient } from "./publish.ts";

const commit = "a".repeat(40);
function bundle(id = "notes", version = "1.2.3"): ToolReleaseBundle {
  const bytes = new TextEncoder().encode("paquete ya verificado por el preparador");
  const tag = `${id}-v${version}`,
    name = `${id}-${version}.lenspkg`;
  const base = `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases`;
  const metadata: ToolReleaseBundle["metadata"] = {
    schemaVersion: 1 as const,
    repository: OFFICIAL_TOOLS_REPOSITORY,
    id,
    version,
    apiVersion: 1,
    minHostVersion: "0.1.0",
    releaseTag: tag,
    asset: {
      name,
      url: `${base}/download/${tag}/${name}`,
      size: bytes.length,
      sha256: releaseSha256(bytes),
    },
    notesUrl: `${base}/tag/${tag}`,
  };
  const files = [
    { name, bytes },
    {
      name: "tool-release.json",
      bytes: new TextEncoder().encode(`${JSON.stringify(metadata, null, 2)}\n`),
    },
  ];
  files.push({
    name: "SHA256SUMS.txt",
    bytes: new TextEncoder().encode(
      `${files
        .map((f) => `${releaseSha256(f.bytes)}  ${f.name}`)
        .sort()
        .join("\n")}\n`,
    ),
  });
  return { metadata, files };
}
function fixture(existing: "none" | "draft" | "public" = "none", count = 0) {
  const local = bundle();
  let release: RemoteToolRelease | null =
    existing === "none"
      ? null
      : {
          id: 42,
          tag_name: local.metadata.releaseTag,
          target_commitish: commit,
          draft: existing === "draft",
          prerelease: false,
        };
  const assets = local.files.slice(0, count).map((file, i) => ({
    id: i + 1,
    name: file.name,
    size: file.bytes.length,
    state: "uploaded",
    bytes: file.bytes,
  }));
  const client: ToolReleaseClient = {
    assertTagCommit: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(async () => release),
    createDraft: vi.fn(async (tag, sha) => {
      release = { id: 42, tag_name: tag, target_commitish: sha, draft: true, prerelease: false };
      return release;
    }),
    listAssets: vi.fn(async () => assets),
    downloadAsset: vi.fn(async (id) => {
      const asset = assets.find((a) => a.id === id);
      if (!asset) throw Error("missing");
      return asset.bytes;
    }),
    uploadAsset: vi.fn(async (_id, file) => {
      assets.push({
        id: assets.length + 1,
        name: file.name,
        size: file.bytes.length,
        state: "uploaded",
        bytes: file.bytes,
      });
    }),
    publish: vi.fn(async () => {
      if (!release) throw Error("missing");
      release = { ...release, draft: false };
      return release;
    }),
  };
  return { local, client, assets };
}

describe("publicación idempotente de una herramienta", () => {
  it("bloquea los pares bootstrap antes de hacer cualquier petición API", async () => {
    for (const id of ["notes", "md-converter"]) {
      const { client } = fixture();
      await expect(publishToolRelease(bundle(id, "0.4.0"), commit, client)).rejects.toThrow(
        /reserved/,
      );
      expect(client.assertTagCommit).not.toHaveBeenCalled();
      expect(client.find).not.toHaveBeenCalled();
      expect(client.createDraft).not.toHaveBeenCalled();
    }
  });

  it("crea draft, sube solo tres assets, verifica bytes y finalmente publica", async () => {
    const { local, client } = fixture();
    const result = await publishToolRelease(local, commit, client);
    expect(result.alreadyPublished).toBe(false);
    expect(result.catalogReleaseTag).toBe(local.metadata.releaseTag);
    expect(client.createDraft).toHaveBeenCalledWith(local.metadata.releaseTag, commit);
    expect(client.uploadAsset).toHaveBeenCalledTimes(3);
    expect(client.downloadAsset).toHaveBeenCalledTimes(3);
    expect(client.publish).toHaveBeenCalledOnce();
    expect(vi.mocked(client.publish).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(client.downloadAsset).mock.invocationCallOrder[2] ?? 0,
    );
  });

  it("reanuda draft parcial con bytes idénticos y no reemplaza el asset ya subido", async () => {
    const { local, client } = fixture("draft", 1);
    await publishToolRelease(local, commit, client);
    expect(client.createDraft).not.toHaveBeenCalled();
    expect(client.uploadAsset).toHaveBeenCalledTimes(2);
    expect(client.publish).toHaveBeenCalledOnce();
  });

  it("reconoce release pública idéntica sin modificarla", async () => {
    const { local, client } = fixture("public", 3);
    expect((await publishToolRelease(local, commit, client)).alreadyPublished).toBe(true);
    expect(client.createDraft).not.toHaveBeenCalled();
    expect(client.uploadAsset).not.toHaveBeenCalled();
    expect(client.publish).not.toHaveBeenCalled();
  });

  it.each(["draft", "public"] as const)(
    "aborta conflictos de bytes en %s, sin mutar lo remoto",
    async (state) => {
      const { local, client, assets } = fixture(state, 3);
      const asset = assets[0];
      if (asset) asset.bytes = new Uint8Array(asset.bytes.length).fill(7);
      await expect(publishToolRelease(local, commit, client)).rejects.toThrow(/bytes conflict/);
      expect(client.uploadAsset).not.toHaveBeenCalled();
      expect(client.publish).not.toHaveBeenCalled();
    },
  );

  it("rechaza públicas incompletas, assets extra y metadatos locales inconsistentes", async () => {
    const incomplete = fixture("public", 2);
    await expect(publishToolRelease(incomplete.local, commit, incomplete.client)).rejects.toThrow(
      /incomplete/,
    );
    const extra = fixture("draft", 3);
    extra.assets.push({
      id: 7,
      name: "unknown.exe",
      size: 1,
      state: "uploaded",
      bytes: new Uint8Array(1),
    });
    await expect(publishToolRelease(extra.local, commit, extra.client)).rejects.toThrow(
      /unexpected/,
    );
    const invalid = fixture();
    invalid.local.metadata.asset.sha256 = "b".repeat(64);
    await expect(publishToolRelease(invalid.local, commit, invalid.client)).rejects.toThrow();
    expect(invalid.client.find).not.toHaveBeenCalled();
  });

  it("errores de API o tag movido impiden publicar", async () => {
    const failed = fixture();
    vi.mocked(failed.client.uploadAsset).mockRejectedValueOnce(Error("network"));
    await expect(publishToolRelease(failed.local, commit, failed.client)).rejects.toThrow(
      "network",
    );
    expect(failed.client.publish).not.toHaveBeenCalled();
    const moved = fixture();
    vi.mocked(moved.client.assertTagCommit).mockRejectedValueOnce(Error("tag moved"));
    await expect(publishToolRelease(moved.local, commit, moved.client)).rejects.toThrow(
      "tag moved",
    );
    expect(moved.client.createDraft).not.toHaveBeenCalled();
  });

  it("reanuda draft parcial con target_commitish main si el SHA real del tag coincide", async () => {
    const f = fixture("draft", 1);
    const existing = {
      id: 42,
      tag_name: f.local.metadata.releaseTag,
      target_commitish: "main",
      draft: true,
      prerelease: false,
    };
    vi.mocked(f.client.find).mockResolvedValue(existing);
    vi.mocked(f.client.publish).mockResolvedValue({ ...existing, draft: false });
    const result = await publishToolRelease(f.local, commit, f.client);
    expect(result.release.target_commitish).toBe("main");
    expect(result.alreadyPublished).toBe(false);
    expect(f.client.uploadAsset).toHaveBeenCalledTimes(2);
    expect(f.client.assertTagCommit).toHaveBeenCalledTimes(3);
    expect(f.client.createDraft).not.toHaveBeenCalled();
  });

  it("conserva pública idéntica con target_commitish main sin mutarla", async () => {
    const f = fixture("public", 3);
    vi.mocked(f.client.find).mockResolvedValue({
      id: 42,
      tag_name: f.local.metadata.releaseTag,
      target_commitish: "main",
      draft: false,
      prerelease: false,
    });
    expect((await publishToolRelease(f.local, commit, f.client)).alreadyPublished).toBe(true);
    expect(f.client.assertTagCommit).toHaveBeenCalledTimes(2);
    expect(f.client.createDraft).not.toHaveBeenCalled();
    expect(f.client.uploadAsset).not.toHaveBeenCalled();
    expect(f.client.publish).not.toHaveBeenCalled();
  });

  it("rechaza un SHA real distinto antes de mutar aunque target_commitish parezca correcto", async () => {
    const f = fixture("draft");
    vi.mocked(f.client.assertTagCommit).mockRejectedValueOnce(
      Error("Remote tag moved from the verified commit"),
    );
    await expect(publishToolRelease(f.local, commit, f.client)).rejects.toThrow(/moved/);
    expect(f.client.find).not.toHaveBeenCalled();
    expect(f.client.createDraft).not.toHaveBeenCalled();
    expect(f.client.uploadAsset).not.toHaveBeenCalled();
    expect(f.client.publish).not.toHaveBeenCalled();
  });

  it("no publica el draft si el tag cambia durante la subida de assets", async () => {
    const f = fixture("draft", 1);
    vi.mocked(f.client.assertTagCommit)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Error("Tag moved before publish"));
    await expect(publishToolRelease(f.local, commit, f.client)).rejects.toThrow(/before publish/);
    expect(f.client.publish).not.toHaveBeenCalled();
  });
});
