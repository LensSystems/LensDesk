import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureRuntime, runSmoke } from "./runtime.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("configureRuntime", () => {
  it("uses the supplied user data directory before startup", () => {
    const setPath = vi.fn();
    expect(configureRuntime(["--smoke"], "/custom/data", setPath)).toBe(true);
    expect(setPath).toHaveBeenCalledWith("/custom/data");
  });

  it("uses a new temporary directory for smoke when none is supplied", () => {
    let path = "";
    expect(configureRuntime(["--smoke"], undefined, (value) => (path = value))).toBe(true);
    expect(path.startsWith(join(tmpdir(), "lensdesk-smoke-"))).toBe(true);
    directories.push(path);
  });

  it("does not override the default path outside smoke", () => {
    const setPath = vi.fn();
    expect(configureRuntime([], undefined, setPath)).toBe(false);
    expect(setPath).not.toHaveBeenCalled();
  });
});

describe("runSmoke", () => {
  it("prints the version only when the host bridge is present", async () => {
    const write = vi.fn();
    const exit = vi.fn();
    await runSmoke(
      async () => true,
      { webContents: { executeJavaScript: async () => true } },
      "0.1.0",
      write,
      exit,
    );
    expect(write).toHaveBeenCalledWith("LENSDESK_SMOKE_OK 0.1.0");
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("exits with code 1 without printing success when the probe fails", async () => {
    const write = vi.fn();
    const exit = vi.fn();
    await runSmoke(
      async () => false,
      { webContents: { executeJavaScript: async () => false } },
      "0.1.0",
      write,
      exit,
    );
    expect(write).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
