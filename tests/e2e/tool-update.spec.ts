import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  stubDialog,
  toolPage,
} from "./helpers.ts";

test("reinstalar una herramienta abierta recarga su pestaña", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-e2e-update-"));
  const app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await installTool(app, shell, lenspkgPath("_template"));
    await shell.getByRole("button", { name: "Abrir Plantilla", exact: true }).click();
    const before = await toolPage(app, "template");
    await before.evaluate(() => {
      (window as unknown as { previousVersion: boolean }).previousVersion = true;
    });

    await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("_template")] });
    await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await expect.poll(() => before.isClosed()).toBe(true);
    await shell.getByRole("button", { name: "Abrir Plantilla", exact: true }).click();
    const after = await toolPage(app, "template");
    expect(
      await after.evaluate(
        () => (window as unknown as { previousVersion?: boolean }).previousVersion ?? false,
      ),
    ).toBe(false);
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
