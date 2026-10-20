import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("plantilla abre archivos con el permiso files", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-template-files-e2e-"));
  const filePath = join(userDataDir, "contenido.txt");
  await writeFile(filePath, "texto local de prueba", "utf8");
  const pkg = lenspkgPath("_template");
  const app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await installTool(app, shell, pkg);
    await stubDialog(app, "open", { canceled: false, filePaths: [filePath] });
    await shell.getByRole("button", { name: "Abrir Plantilla", exact: true }).click();
    const tool = await toolPage(app, "template");
    await tool.getByRole("button", { name: "Abrir archivo" }).click();
    await expect(tool.getByText("texto local de prueba", { exact: true })).toBeVisible();
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
