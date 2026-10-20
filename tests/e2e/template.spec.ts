import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, installTool, launchApp, toolPage } from "./helpers.ts";

test("plantilla conserva storage después de reiniciar LensDesk", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-template-e2e-"));
  const pkg = resolve(import.meta.dirname, "../../tools/_template/dist/template-0.1.0.lenspkg");
  let app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await installTool(app, shell, pkg);
    await expect(shell.getByText("sin firmar", { exact: true })).toBeVisible();
    await shell.getByRole("button", { name: "Abrir Plantilla", exact: true }).click();
    let tool = await toolPage(app, "template");
    await expect(tool.getByText("Contador: 0")).toBeVisible();
    await tool.getByRole("button", { name: "Incrementar contador" }).click();
    await expect(tool.getByText("Contador: 1")).toBeVisible();
    await app.close();
    app = await launchApp({ userDataDir });
    tool = await toolPage(app, "template");
    await expect(tool.getByText("Contador: 1")).toBeVisible();
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
