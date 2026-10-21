import { describe, expect, it, vi } from "vitest";
import { checkForUpdate, pickInstallerAsset } from "./check.ts";
import { createUpdateService } from "./update-service.ts";

const asset = (name: string) => ({
  name,
  browser_download_url: `https://github.com/o/r/releases/download/v0.2.0/${name}`,
});
const assets = [
  "LensDesk-0.2.0-mac-arm64.zip",
  "LensDesk-0.2.0-mac-arm64.dmg",
  "LensDesk-0.2.0-mac-x64.dmg",
  "LensDesk-0.2.0-win-x64.exe",
].map(asset);
const base = {
  repo: "o/r",
  enabled: true,
  lastCheckedAt: null,
  now: () => new Date(),
  currentVersion: "0.1.0",
};
const fetchRelease = (entries = assets) =>
  vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      tag_name: "v0.2.0",
      html_url: "https://github.com/o/r/releases/tag/v0.2.0",
      assets: entries,
    }),
  }));

describe("assets de actualización", () => {
  it.each([
    ["darwin", "arm64", 1],
    ["darwin", "x64", 2],
    ["win32", "x64", 3],
  ] as const)("elige instalador para %s %s", (platform, arch, index) => {
    expect(pickInstallerAsset(assets, platform, arch, "0.2.0")).toEqual(assets[index]);
  });
  it("no elige zip, otra versión ni arquitectura incompatible", () => {
    expect(
      pickInstallerAsset([asset("LensDesk-0.2.0-mac-arm64.zip")], "darwin", "arm64", "0.2.0"),
    ).toBeUndefined();
    expect(pickInstallerAsset(assets, "darwin", "arm64", "0.3.0")).toBeUndefined();
    expect(pickInstallerAsset(assets, "win32", "arm64", "0.2.0")).toBeUndefined();
  });
  it("elige el instalador y detecta solo herramientas instaladas con versión mayor en un único GET", async () => {
    const fetch = fetchRelease([
      ...assets,
      ...[
        "notes-0.2.0.lenspkg",
        "notes-0.1.0.lenspkg",
        "other-0.3.0.lenspkg",
        "notes-01.3.0.lenspkg",
      ].map(asset),
    ]);
    const result = await checkForUpdate({
      ...base,
      platform: "darwin",
      arch: "arm64",
      installedTools: () => [{ id: "notes", version: "0.1.0" }],
      fetch,
    });
    expect(result).toMatchObject({
      kind: "available",
      installerUrl: asset("LensDesk-0.2.0-mac-arm64.dmg").browser_download_url,
      tools: [
        { id: "notes", version: "0.2.0", url: asset("notes-0.2.0.lenspkg").browser_download_url },
      ],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("descarta URLs ajenas y conserva la página como alternativa", async () => {
    const fetch = fetchRelease(
      [
        "https://evil.test/o/r/releases/download/x",
        "https://github.com/other/r/releases/download/x",
        "http://github.com/o/r/releases/download/x",
        "https://github.com@evil.test/o/r/releases/download/x",
        "invalid",
      ].map((browser_download_url) => ({
        name: "LensDesk-0.2.0-mac-arm64.dmg",
        browser_download_url,
      })),
    );
    expect(await checkForUpdate({ ...base, platform: "darwin", arch: "arm64", fetch })).toEqual({
      kind: "available",
      version: "0.2.0",
      url: "https://github.com/o/r/releases/tag/v0.2.0",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("emite herramientas aunque la app esté al día", async () => {
    const emit = vi.fn();
    const emitTools = vi.fn();
    const fetch = fetchRelease([asset("notes-0.2.0.lenspkg")]);
    const service = createUpdateService({
      repo: "o/r",
      currentVersion: "0.2.0",
      fetch,
      now: base.now,
      installedTools: () => [{ id: "notes", version: "0.1.0" }],
      settings: { enabled: () => true, lastCheckedAt: () => null, setLastCheckedAt: vi.fn() },
      emit,
      emitTools,
      log: vi.fn(),
    });
    await expect(service.run()).resolves.toMatchObject({
      kind: "none",
      tools: [{ id: "notes", version: "0.2.0" }],
    });
    expect(emit).not.toHaveBeenCalled();
    expect(emitTools).toHaveBeenCalledWith({
      tools: [
        { id: "notes", version: "0.2.0", url: asset("notes-0.2.0.lenspkg").browser_download_url },
      ],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
