import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const root = resolve(import.meta.dirname, "../..");

test("la aplicación empaquetada pasa su smoke", () => {
  const platform = process.platform;
  const architecture = process.arch;
  let appPath: string;
  let executable: string;

  if (platform === "darwin") {
    const directory = architecture === "arm64" ? "mac-arm64" : "mac";
    appPath = resolve(root, "apps/desktop/release", directory, "LensDesk.app");
    executable = resolve(appPath, "Contents/MacOS/LensDesk");
  } else if (platform === "win32") {
    appPath = resolve(root, "apps/desktop/release/win-unpacked");
    executable = resolve(appPath, "LensDesk.exe");
  } else {
    throw new Error(`Plataforma no compatible: ${platform}`);
  }

  expect(existsSync(executable), `No existe el binario empaquetado: ${executable}`).toBe(true);
  const output = execFileSync(
    "node",
    ["scripts/smoke-check.ts", "--exe", executable, "DB", "FTS5_MAIN", "FTS5_UTILITY", "TOOLS"],
    { cwd: root, encoding: "utf8", timeout: 150_000 },
  );
  expect(output).toContain("LENSDESK_SMOKE_OK ");
  expect(output).toContain("LENSDESK_SMOKE_DB_OK");
  expect(output).toContain("LENSDESK_SMOKE_FTS5_MAIN_OK");
  expect(output).toContain("LENSDESK_SMOKE_FTS5_UTILITY_OK");
  expect(output).toContain("LENSDESK_SMOKE_TOOLS_OK");

  if (platform === "darwin") {
    execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
      cwd: root,
      encoding: "utf8",
      timeout: 30_000,
    });
  }
});
