import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  shellPage,
  toolPage,
} from "./helpers.ts";

test("Notas pasa a Ver al ocultarse y al cambiar de nota, y guarda lo escrito", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    await enableDeveloperMode(shell);
    await installTool(app, shell, lenspkgPath("notes"), "Notas");
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const notes = await toolPage(app, "notes");
    await notes.getByRole("button", { name: "Nueva nota" }).first().click();
    const edit = notes.getByRole("radio", { name: "Editar", exact: true });
    const view = notes.getByRole("radio", { name: "Ver", exact: true });
    await expect(edit).toBeChecked();
    await notes.locator(".cm-content").fill("Texto escrito antes de salir");
    // Ir a Ajustes oculta la vista de la herramienta.
    await shell.getByRole("button", { name: "Ajustes", exact: true }).click();
    await shell.getByRole("tab", { name: "Notas" }).click();
    await expect(view).toBeChecked();
    await expect(notes.locator(".ld-markdown-view")).toContainText("Texto escrito antes de salir");
    // Una nota nueva abre en Editar; volver a la anterior la muestra en Ver.
    await notes.getByRole("button", { name: "Nueva nota" }).first().click();
    await expect(edit).toBeChecked();
    await notes
      .getByRole("navigation", { name: "Lista de notas" })
      .getByText("Texto escrito antes de salir")
      .click();
    await expect(view).toBeChecked();
  } finally {
    await app.close();
  }
});
