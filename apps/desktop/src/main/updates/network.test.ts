import { TOOL_CATALOG_LIMITS } from "@lensdesk/lenspkg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_RELEASE_BYTES, readUpdateText, type UpdateHttpFetch } from "./network.ts";
import { readAppUpdate, readToolsCatalog } from "./sources.ts";
import { appResponse, catalogRelease, catalogResponse } from "./test-fixtures.ts";

const repo = "LensSystems/LensDesk";
const body = (bytes: Uint8Array) => new Response(bytes as BodyInit);
const from =
  (response: Response): UpdateHttpFetch =>
  async () =>
    response;
const queries = [
  [
    "app",
    APP_RELEASE_BYTES,
    (fetch: UpdateHttpFetch) => readAppUpdate({ repo, fetch, currentVersion: "0.4.0" }),
    appResponse,
  ],
  [
    "catalog",
    TOOL_CATALOG_LIMITS.catalogBytes,
    (fetch: UpdateHttpFetch) => readToolsCatalog({ repo, fetch }),
    catalogResponse,
  ],
] as const;
afterEach(() => vi.useRealTimers());

describe.each(queries)("fronteras de red %s", (_name, limit, query, valid) => {
  it.each([403, 429, 302])("rechaza HTTP %s sin reinterpretar como éxito vacío", async (status) => {
    await expect(query(from(new Response("blocked", { status })))).rejects.toThrow();
  });
  it("rechaza offline, JSON malicioso y UTF8 inválido", async () => {
    await expect(
      query(async () => {
        throw Error("offline");
      }),
    ).rejects.toThrow();
    for (const value of ["not json", '{"__proto__":{"polluted":true}}', "null", "[]"])
      await expect(query(from(new Response(value)))).rejects.toThrow();
    await expect(query(from(body(new Uint8Array([0xc3, 0x28]))))).rejects.toThrow();
    expect(Object.prototype).not.toHaveProperty("polluted");
  });
  it("limita bytes reales antes del parse, incluidos caracteres multibyte y Content-Length engañoso", async () => {
    const bytes = new TextEncoder().encode("é".repeat(Math.floor(limit / 2) + 1));
    await expect(
      query(from(new Response(bytes, { headers: { "content-length": "1" } }))),
    ).rejects.toThrow(/byte limit/);
    await expect(
      query(from(new Response("{}", { headers: { "content-length": String(limit + 1) } }))),
    ).rejects.toThrow(/byte limit/);
  });
  it("rechaza una respuesta redirigida o con URL final distinta", async () => {
    for (const change of [{ redirected: true }, { url: "https://evil.test/data" }]) {
      const response = valid();
      for (const [key, value] of Object.entries(change))
        Object.defineProperty(response, key, { value });
      await expect(query(from(response))).rejects.toThrow(/redirected/);
    }
  });
});

describe("deadline total y validación de fuentes", () => {
  it.each(["fetch", "body"])("timeout de 10 s incluye %s que no finaliza", async (stage) => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const cancel = vi.fn();
    const fetch: UpdateHttpFetch = async (_url, init) => {
      signal = init.signal;
      if (stage === "fetch") return new Promise<Response>(() => {});
      return new Response(new ReadableStream<Uint8Array>({ cancel }));
    };
    const pending = readUpdateText({
      url: "https://api.github.com/repos/LensSystems/LensDesk/releases/latest",
      accept: "application/json",
      maxBytes: 100,
      fetch,
    });
    const assertion = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(9999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(signal?.aborted).toBe(true);
    if (stage === "body") expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("cancela el stream al exceder límite y acepta el borde exacto", async () => {
    const cancel = vi.fn();
    const fetch = from(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(11));
          },
          cancel,
        }),
      ),
    );
    await expect(
      readUpdateText({
        url: "https://fixed.test/",
        accept: "application/json",
        maxBytes: 10,
        fetch,
      }),
    ).rejects.toThrow(/byte limit/);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(
      await readUpdateText({
        url: "https://fixed.test/",
        accept: "application/json",
        maxBytes: 10,
        fetch: from(new Response("1234567890")),
      }),
    ).toBe("1234567890");
  });
  it("rechaza catálogo de esquema futuro, conflicto duplicado y asset de otro origen", async () => {
    const first = catalogRelease();
    const base = {
      schemaVersion: 1,
      repository: repo,
      generatedAt: "2026-11-04T12:00:00.000Z",
      releases: [first],
    };
    for (const value of [
      { ...base, schemaVersion: 2 },
      { ...base, releases: [first, { ...first, minHostVersion: "0.3.0" }] },
      {
        ...base,
        releases: [{ ...first, asset: { ...first.asset, url: "https://evil.test/package" } }],
      },
    ])
      await expect(readToolsCatalog({ repo, fetch: from(Response.json(value)) })).rejects.toThrow();
  });
  it("app exige enlace exacto del repo/tag y nunca ofrece instaladores de URL ajena/query", async () => {
    const base = { tag_name: "v0.5.0", html_url: `https://github.com/${repo}/releases/tag/v0.5.0` };
    for (const html_url of [
      "http://github.com/path",
      `${base.html_url}?x`,
      `${base.html_url}#x`,
      "https://github.com/other/repo/releases/tag/v0.5.0",
    ])
      await expect(
        readAppUpdate({
          repo,
          currentVersion: "0.4.0",
          fetch: from(Response.json({ ...base, html_url })),
        }),
      ).rejects.toThrow();
    for (const browser_download_url of [
      "https://evil.test/installer",
      `https://github.com/${repo}/releases/download/v0.5.0/LensDesk-0.5.0-mac-arm64.dmg?x`,
    ]) {
      const result = await readAppUpdate({
        repo,
        currentVersion: "0.4.0",
        platform: "darwin",
        arch: "arm64",
        fetch: from(
          Response.json({
            ...base,
            assets: [{ name: "LensDesk-0.5.0-mac-arm64.dmg", browser_download_url }],
          }),
        ),
      });
      expect(result).toEqual({ version: "0.5.0", html_url: base.html_url });
    }
  });
});
