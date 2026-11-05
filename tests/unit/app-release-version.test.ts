import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertAppReleaseVersion } from "../../scripts/check-app-release.ts";

describe("identidad de la release de aplicación", () => {
  it("acepta el tag estable y ambas versiones iguales", () => {
    expect(assertAppReleaseVersion("v0.5.0", "0.5.0", "0.5.0")).toBe("0.5.0");
  });
  const invalidCases: [string, unknown, unknown][] = [
    ["v0.5.1", "0.5.0", "0.5.0"],
    ["notes-v0.5.0", "0.5.0", "0.5.0"],
    ["v0.5.0", "0.5.0", "0.4.0"],
    ["v0.5.0", undefined, undefined],
    ...["v0.5.0", "00.5.0", "0.5.0-beta.1", "0.5.0+build", "0.5.0\n", "9007199254740992.0.0"].map(
      (version): [string, unknown, unknown] => [`v${version}`, version, version],
    ),
  ];
  it.each(invalidCases)("rechaza tag/version incoherentes %s/%s/%s", (tag, root, desktop) => {
    expect(() => assertAppReleaseVersion(tag, root, desktop)).toThrow();
  });
  it("el CLI valida archivos reales sin Git, dependencias ni red", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lensdesk-app-release-"));
    try {
      await mkdir(join(directory, "apps/desktop"), { recursive: true });
      for (const file of ["package.json", "apps/desktop/package.json"])
        await writeFile(join(directory, file), JSON.stringify({ version: "0.5.0" }));
      const run = (tag: string) =>
        spawnSync(process.execPath, [resolve("scripts/check-app-release.ts"), tag], {
          cwd: directory,
          encoding: "utf8",
        });
      expect(run("v0.5.0").status).toBe(0);
      const mismatch = run("v0.5.1");
      expect(mismatch.status).toBe(1);
      expect(mismatch.stderr).toContain("App tag must match");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
