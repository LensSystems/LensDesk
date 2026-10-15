import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  protocol: { registerSchemesAsPrivileged: vi.fn() },
  session: {
    fromPartition: vi.fn(() => ({
      protocol: { handle: vi.fn() },
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      webRequest: { onBeforeRequest: vi.fn() },
    })),
  },
}));

import { resolveToolFile, toolResponseHeaders } from "./protocol.ts";

describe("resolveToolFile", () => {
  let root = "";
  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = "";
  });
  async function setup() {
    root = await mkdtemp(join(tmpdir(), "lensdesk-protocol-"));
    await mkdir(join(root, "tool", "ui"), { recursive: true });
    await writeFile(join(root, "tool", "ui", "index.html"), "ok");
    const registry = {
      get: (id: string) =>
        id === "my-tool" ? { id, installPath: join(root, "tool"), enabled: true } : undefined,
    };
    return { registry, ui: await realpath(join(root, "tool", "ui")) };
  }
  it("una sesión no sirve archivos de otra herramienta", async () => {
    const { registry, ui } = await setup();
    expect(
      await resolveToolFile({ url: "lenstool://my-tool/", registry, ownerToolId: "other-tool" }),
    ).toBeNull();
    expect(
      await resolveToolFile({ url: "lenstool://my-tool/", registry, ownerToolId: "my-tool" }),
    ).toBe(join(ui, "index.html"));
  });
  it("serves root as index and accepts ordinary files", async () => {
    const { registry, ui } = await setup();
    expect(await resolveToolFile({ url: "lenstool://my-tool/", registry })).toBe(
      join(ui, "index.html"),
    );
  });
  it.each([
    "../secret",
    "%2e%2e/secret",
    "%2E%2E%2fsecret",
    "%2e%2e%5csecret",
    "a%5cb",
    "%00",
    "/etc/passwd",
    "//evil/a",
  ])("rejects unsafe path %s", async (path) => {
    const { registry } = await setup();
    expect(await resolveToolFile({ url: `lenstool://my-tool/${path}`, registry })).toBeNull();
  });
  it("rejects invalid host, unknown and disabled tools", async () => {
    const { registry } = await setup();
    expect(await resolveToolFile({ url: "lenstool://other/", registry })).toBeNull();
    expect(await resolveToolFile({ url: "lenstool://Bad/", registry })).toBeNull();
    expect(await resolveToolFile({ url: "lenstool://MY-TOOL/", registry })).toBeNull();
    expect(
      await resolveToolFile({
        url: "lenstool://off/",
        registry: { get: () => ({ id: "off", installPath: root, enabled: false }) },
      }),
    ).toBeNull();
    expect(await resolveToolFile({ url: "https://my-tool/", registry })).toBeNull();
  });
  it("rejects symlinks whose real target escapes ui", async () => {
    const { registry } = await setup();
    await writeFile(join(root, "secret.txt"), "secret");
    await symlink(join(root, "secret.txt"), join(root, "tool", "ui", "link.txt"));
    expect(await resolveToolFile({ url: "lenstool://my-tool/link.txt", registry })).toBeNull();
  });
  it("sets a CSP, nosniff and extension MIME types", () => {
    expect(toolResponseHeaders("file.mjs")).toMatchObject({
      "Content-Type": "text/javascript; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    expect(toolResponseHeaders("file.html")["Content-Security-Policy"]).toContain(
      "default-src 'self' lenstool:",
    );
  });
});
