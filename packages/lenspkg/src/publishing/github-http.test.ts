import { describe, expect, it, vi } from "vitest";
import { createGitHubToolReleaseClient } from "./github-client.ts";
import { createGitHubReleaseHttp } from "./github-http.ts";

const api = "/repos/LensSystems/LensDesk";
const token = "secret-test-token";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const release = {
  id: 42,
  tag_name: "notes-v1.2.3",
  target_commitish: "a".repeat(40),
  draft: true,
  prerelease: false,
};

describe("cliente HTTP oficial de publicación", () => {
  it("no reenvía token al CDN y rechaza otra redirección posterior", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://release-assets.githubusercontent.com/example?signature=fixture",
          },
        }),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    const http = createGitHubReleaseHttp(token, fetcher);
    expect(await http.downloadAsset(1, 3)).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: `Bearer ${token}` });
    expect(fetcher.mock.calls[1]?.[1]?.headers).not.toHaveProperty("Authorization");
    expect(fetcher.mock.calls.every(([, init]) => init?.redirect === "manual")).toBe(true);
  });

  it.each([
    "https://evil.test/file",
    "http://release-assets.githubusercontent.com/file",
    "https://user@release-assets.githubusercontent.com/file",
    "https://release-assets.githubusercontent.com.evil.test/file",
  ])("bloquea redirect no autorizado %s", async (location) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
    await expect(createGitHubReleaseHttp(token, fetcher).downloadAsset(1, 10)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("aplica límites reales del cuerpo y no incluye respuestas o tokens en errores", async () => {
    const big = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array(4)));
    await expect(createGitHubReleaseHttp(token, big).downloadAsset(1, 3)).rejects.toThrow(
      /size limit/,
    );
    const denied = vi.fn<typeof fetch>().mockResolvedValue(new Response(token, { status: 403 }));
    await expect(
      createGitHubReleaseHttp(token, denied).json("GET", `${api}/releases`),
    ).rejects.toThrow("GitHub API responded with 403");
    const network = vi.fn<typeof fetch>().mockRejectedValue(Error(token));
    await expect(
      createGitHubReleaseHttp(token, network).json("GET", `${api}/releases`),
    ).rejects.toThrow("GitHub request failed");
  });

  it("rechaza endpoint de otro repo, traversal o credenciales antes de fetch", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const http = createGitHubReleaseHttp(token, fetcher);
    for (const endpoint of [
      "/repos/other/repo/releases",
      `${api}/../releases`,
      `${api}/releases%2fextra`,
      "https://user@evil.test/path",
    ])
      await expect(http.json("GET", endpoint)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("encuentra drafts paginados y publica siempre con make_latest false", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json(
          Array.from({ length: 100 }, (_, i) => ({
            ...release,
            id: i + 1,
            tag_name: `other-v1.0.${i}`,
          })),
        ),
      )
      .mockResolvedValueOnce(json([release]))
      .mockResolvedValueOnce(json(release))
      .mockResolvedValueOnce(json({ ...release, draft: false }));
    const client = createGitHubToolReleaseClient(token, fetcher);
    expect(await client.find(release.tag_name)).toEqual(release);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("page=2");
    await client.createDraft(release.tag_name, release.target_commitish);
    await client.publish(42);
    for (const call of fetcher.mock.calls.slice(2))
      expect(JSON.parse(String(call[1]?.body))).toMatchObject({
        make_latest: "false",
        prerelease: false,
      });
    expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toMatchObject({ draft: true });
  });

  it("rechaza el SHA real incorrecto del tag desde la API, sin solicitudes de escritura", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ object: { type: "commit", sha: "b".repeat(40) } }));
    await expect(
      createGitHubToolReleaseClient(token, fetcher).assertTagCommit(
        release.tag_name,
        release.target_commitish,
      ),
    ).rejects.toThrow(/Remote tag moved/);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it("rechaza truncamiento de paginación y valida tags anotados", async () => {
    const full = vi.fn<typeof fetch>().mockImplementation(async () =>
      json(
        Array.from({ length: 100 }, (_, i) => ({
          ...release,
          id: i + 1,
          tag_name: `other-v1.0.${i}`,
        })),
      ),
    );
    await expect(createGitHubToolReleaseClient(token, full).find(release.tag_name)).rejects.toThrow(
      /pagination/,
    );
    expect(full).toHaveBeenCalledTimes(100);
    const tag = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ object: { type: "tag", sha: "b".repeat(40) } }))
      .mockResolvedValueOnce(json({ object: { type: "commit", sha: release.target_commitish } }));
    await expect(
      createGitHubToolReleaseClient(token, tag).assertTagCommit(
        release.tag_name,
        release.target_commitish,
      ),
    ).resolves.toBeUndefined();
  });
});
