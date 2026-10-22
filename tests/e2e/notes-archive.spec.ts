import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  shellPage,
  toolPage,
} from "./helpers.ts";

test("archivar saca la nota de Notas y de la búsqueda, y se puede desarchivar", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    await enableDeveloperMode(shell);
    await installTool(app, shell, lenspkgPath("notes"), "Notas");
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const notes = await toolPage(app, "notes");
    await notes.getByRole("heading", { name: "Guía de Markdown" }).waitFor();
    await notes.getByRole("button", { name: "Nueva nota" }).first().click();
    const title = notes.getByRole("textbox", { name: "Título de la nota" });
    await title.fill("Archivable");
    await title.press("Enter");
    await notes.locator(".cm-content").fill("Texto archivado");
    const row = notes.getByRole("button", { name: "Archivable" });
    await expect(row).toBeVisible();

    // La nota nueva es la primera de la lista.
    await notes.getByRole("button", { name: "Archivar nota", exact: true }).first().click();
    await expect(row).toHaveCount(0);
    await notes.getByRole("textbox", { name: "Buscar notas" }).fill("Archivable");
    await expect(row).toHaveCount(0);
    await notes.getByRole("textbox", { name: "Buscar notas" }).fill("");

    await notes.getByRole("radio", { name: "Archivadas", exact: true }).click();
    await expect(row).toBeVisible();
    await expect(notes.getByRole("button", { name: "Guía de Markdown" })).toHaveCount(0);
    await notes.getByRole("button", { name: "Desarchivar nota", exact: true }).click();
    await expect(notes.getByText("No hay notas archivadas").first()).toBeVisible();

    await notes.getByRole("radio", { name: "Notas", exact: true }).click();
    await expect(row).toBeVisible();
  } finally {
    await app.close();
  }
});
