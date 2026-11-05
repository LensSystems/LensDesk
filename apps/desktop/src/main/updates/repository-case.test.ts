import { describe, expect, it } from "vitest";
import { readAppUpdate } from "./sources.ts";
import { updateFixture } from "./test-fixtures.ts";

const name = "LensDesk-0.5.0-mac-arm64.dmg";
const release = (repo: string) => ({
  tag_name: "v0.5.0",
  html_url: `https://github.com/${repo}/releases/tag/v0.5.0`,
  assets: [
    { name, browser_download_url: `https://github.com/${repo}/releases/download/v0.5.0/${name}` },
  ],
});
const read = (repo: string, value: ReturnType<typeof release>) =>
  readAppUpdate({
    repo,
    currentVersion: "0.4.0",
    platform: "darwin",
    arch: "arm64",
    fetch: async () => Response.json(value),
  });

describe("identidad de repositorio GitHub sin distinguir mayúsculas", () => {
  it.each([
    ["lenssystems/lensdesk", "LensSystems/LensDesk"],
    ["Owner/REPO", "oWNER/Repo"],
  ])("acepta app e instalador canónicos %s desde %s", async (configured, canonical) => {
    const value = release(canonical);
    expect(await read(configured, value)).toEqual({
      version: "0.5.0",
      html_url: value.html_url,
      installerUrl: value.assets[0]?.browser_download_url,
    });
  });

  it("config oficial en minúsculas mantiene ambas fuentes e instalador canónico", async () => {
    const fixture = updateFixture("lenssystems/lensdesk", { platform: "darwin", arch: "arm64" });
    const value = release("LensSystems/LensDesk");
    fixture.state.app = () => Response.json(value);
    expect(await fixture.service.run(true)).toMatchObject({
      kind: "available",
      installerUrl: value.assets[0]?.browser_download_url,
      sources: {
        app: { status: "success" },
        tools: { status: "success", updates: [{ id: "notes", version: "0.4.5" }] },
      },
    });
    expect(fixture.fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://api.github.com/repos/lenssystems/lensdesk/releases/latest",
      "https://lenssystems.github.io/LensDesk/tools-catalog-v1.json",
    ]);
  });

  const unsafePages = [
    "http://github.com/LensSystems/LensDesk/releases/tag/v0.5.0",
    "https://evil.test/LensSystems/LensDesk/releases/tag/v0.5.0",
    "https://github.com@evil.test/LensSystems/LensDesk/releases/tag/v0.5.0",
    "https://user:pass@github.com/LensSystems/LensDesk/releases/tag/v0.5.0",
    "https://github.com/LensSystems/Other/releases/tag/v0.5.0",
    "https://github.com/Other/LensDesk/releases/tag/v0.5.0",
    "https://github.com/%4censSystems/LensDesk/releases/tag/v0.5.0",
    "https://github.com/LensSystems/%4censDesk/releases/tag/v0.5.0",
    "https://github.com/LensSystems/LensDesk/Releases/tag/v0.5.0",
    "https://github.com/LensSystems/LensDesk/releases/Tag/v0.5.0",
    "https://github.com/LensSystems/LensDesk/releases/tag/V0.5.0",
    "https://github.com/LensSystems/LensDesk/releases/tag/v0.5.0?x=1",
    "https://github.com/LensSystems/LensDesk/releases/tag/v0.5.0#fragment",
    "https://github.com/LensSystems//LensDesk/releases/tag/v0.5.0",
    "https://github.com/LensSystems/LensDesk/./releases/tag/v0.5.0",
    "https://github.com/LensSystems/LensDesk/releases/tag/v0.5.0\n",
  ];
  it.each(unsafePages)("rechaza página alterada %s", async (html_url) => {
    await expect(
      read("lenssystems/lensdesk", { ...release("LensSystems/LensDesk"), html_url }),
    ).rejects.toThrow(/identity/);
  });

  it.each([
    `https://github.com/LensSystems/LensDesk/releases/download/V0.5.0/${name}`,
    `https://github.com/LensSystems/LensDesk/Releases/download/v0.5.0/${name}`,
    `https://github.com/LensSystems/LensDesk/releases/Download/v0.5.0/${name}`,
    `https://github.com/LensSystems/LensDesk/releases/download/v0.5.0/${name.toLowerCase()}`,
    `https://github.com/LensSystems/LensDesk/releases/download/v0.5.0/${name}?x=1`,
    `https://github.com/LensSystems/LensDesk/releases/download/v0.5.0/${name}#fragment`,
    `https://github.com/%4censSystems/LensDesk/releases/download/v0.5.0/${name}`,
    `https://github.com/LensSystems/%4censDesk/releases/download/v0.5.0/${name}`,
    `https://user@github.com/LensSystems/LensDesk/releases/download/v0.5.0/${name}`,
    `https://evil.test/LensSystems/LensDesk/releases/download/v0.5.0/${name}`,
    `https://github.com/Other/LensDesk/releases/download/v0.5.0/${name}`,
    `https://github.com/LensSystems/LensDesk/releases/download/v0.5.0//${name}`,
  ])("filtra instalador inseguro sin perder la página válida %s", async (browser_download_url) => {
    const value = release("LensSystems/LensDesk");
    value.assets = [{ name, browser_download_url }];
    expect(await read("lenssystems/lensdesk", value)).toEqual({
      version: "0.5.0",
      html_url: value.html_url,
    });
  });

  it("un nombre de asset con mayúsculas distintas no se convierte en instalador", async () => {
    const value = release("LensSystems/LensDesk");
    const otherName = name.toLowerCase();
    value.assets = [
      {
        name: otherName,
        browser_download_url: `https://github.com/LensSystems/LensDesk/releases/download/v0.5.0/${otherName}`,
      },
    ];
    expect(await read("lenssystems/lensdesk", value)).toEqual({
      version: "0.5.0",
      html_url: value.html_url,
    });
  });
});
