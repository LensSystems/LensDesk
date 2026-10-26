import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

import { checkSingleInstance } from "./single-instance-check.ts";

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

test("la aplicación empaquetada solo permite una instancia desde la terminal", async () => {
  const executable =
    process.platform === "darwin"
      ? resolve(
          root,
          "apps/desktop/release",
          process.arch === "arm64" ? "mac-arm64" : "mac",
          "LensDesk.app/Contents/MacOS/LensDesk",
        )
      : resolve(root, "apps/desktop/release/win-unpacked/LensDesk.exe");
  expect(existsSync(executable)).toBe(true);
  await checkSingleInstance(executable, []);
});

test("la app instalada permite configurar el inicio de sesión", async () => {
  const executablePath =
    process.platform === "darwin"
      ? resolve(
          root,
          "apps/desktop/release",
          process.arch === "arm64" ? "mac-arm64" : "mac",
          "LensDesk.app/Contents/MacOS/LensDesk",
        )
      : resolve(root, "apps/desktop/release/win-unpacked/LensDesk.exe");
  const userData = await mkdtemp(resolve(tmpdir(), "lensdesk-login-"));
  const app = await electron.launch({
    executablePath,
    env: { ...process.env, LENSDESK_USER_DATA: userData },
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await expect(page.getByRole("switch", { name: "Abrir al iniciar sesión" })).toBeEnabled();
  } finally {
    await app.close();
    await rm(userData, { recursive: true, force: true });
  }
});
