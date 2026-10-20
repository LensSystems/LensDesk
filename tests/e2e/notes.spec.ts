import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

test("Notas conserva una nota después de reiniciar LensDesk", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-notes-e2e-"));
  const pkg = lenspkgPath("notes");
  let app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [pkg] });
    await shell.getByRole("button", { name: "Herramientas" }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await shell.getByText("Notas", { exact: true }).waitFor();
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
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

test("un título largo no saca de la lista los botones de fijar y borrar", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-notes-e2e-"));
  const pkg = lenspkgPath("notes");
  const app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [pkg] });
    await shell.getByRole("button", { name: "Herramientas" }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await shell.getByText("Notas", { exact: true }).waitFor();
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const tool = await toolPage(app, "notes");
    await tool.getByRole("button", { name: "Nueva nota" }).first().click();
    const title = "Un título muy largo ".repeat(12).trim();
    await tool.locator(".cm-content").fill(`# ${title}\nCuerpo`);
    await expect(tool.getByRole("button", { name: title })).toBeVisible();

    const list = await tool.getByRole("navigation", { name: "Lista de notas" }).boundingBox();
    for (const name of ["Fijar nota", "Mover a la papelera"]) {
      const button = tool.getByRole("button", { name, exact: true });
      await expect(button).toBeInViewport({ ratio: 1 });
      const box = await button.boundingBox();
      expect(list && box && box.x + box.width <= list.x + list.width, name).toBe(true);
    }
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
