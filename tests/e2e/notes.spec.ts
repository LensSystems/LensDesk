import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, stubDialog, toolPage } from "./helpers.ts";

test("Notas conserva una nota después de reiniciar LensDesk", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-notes-e2e-"));
  const pkg = resolve(import.meta.dirname, "../../tools/notes/dist/notes-0.1.0.lenspkg");
  let app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [pkg] });
    await shell.getByRole("button", { name: "Herramientas" }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await shell.getByText("Notas", { exact: true }).waitFor();
    await shell.getByRole("button", { name: "Notas", exact: true }).click();
    let tool = await toolPage(app, "notes");
    await tool.getByRole("button", { name: "Nueva nota" }).first().click();
    await tool.locator(".cm-content").fill("# Persistencia local\nTexto que debe seguir aquí");
    await expect(tool.getByRole("heading", { name: "Persistencia local" })).toBeVisible();
    await tool.getByRole("textbox", { name: "Buscar notas" }).fill("Persistencia local");
    await expect(tool.getByRole("button", { name: "Persistencia local" })).toBeVisible();
    await tool.waitForTimeout(900);
    await app.close();
    app = await launchApp({ userDataDir });
    tool = await toolPage(app, "notes");
    await expect(tool.getByRole("heading", { name: "Persistencia local" })).toBeVisible();
    await expect(tool.locator(".cm-content")).toContainText("Texto que debe seguir aquí");

    await tool.getByRole("button", { name: "Mover a la papelera" }).first().click();
    await tool.getByRole("radio", { name: "Papelera", exact: true }).click();
    await expect(tool.getByRole("button", { name: "Persistencia local" })).toBeVisible();
    await tool.getByRole("button", { name: "Vaciar papelera" }).click();
    await tool.getByRole("dialog").getByRole("button", { name: "Vaciar papelera" }).click();
    await expect(tool.getByRole("button", { name: "Persistencia local" })).toHaveCount(0);
    await expect(tool.getByRole("alert")).toHaveCount(0);
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
