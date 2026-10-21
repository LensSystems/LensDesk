import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  launchApp,
  lenspkgPath,
  shellPage,
  stubDialog,
  toolPage,
} from "./helpers.ts";

test("el título inicial conserva el foco sin contorno y los botones muestran mano", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    const heading = shell.getByRole("heading", { name: "Herramientas", exact: true });
    await expect(heading).toBeFocused();
    await expect(heading).toHaveCSS("outline-style", "none");
    const button = shell.getByRole("button", { name: "Agregar herramienta…" });
    await expect(button).toHaveCSS("cursor", "pointer");
    await shell.keyboard.press("Tab");
    await expect(shell.locator(":focus-visible")).toHaveCSS("outline-style", "solid");
  } finally {
    await app.close();
  }
});

test("el título no se selecciona y la vista previa de Notas sí", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    await shell
      .getByRole("heading", { name: "Herramientas", exact: true })
      .click({ clickCount: 3 });
    expect(await shell.evaluate(() => window.getSelection()?.toString())).toBe("");
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("notes")] });
    await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const notes = await toolPage(app, "notes");
    await notes.getByRole("button", { name: "Nueva nota" }).first().click();
    await notes.locator(".cm-content").fill("# Texto seleccionable\nContenido para copiar");
    await notes.getByRole("radio", { name: "Vista previa", exact: true }).click();
    const preview = notes
      .locator(".ld-markdown-view")
      .getByRole("heading", { name: "Texto seleccionable" });
    await expect(preview).toBeVisible();
    await notes.evaluate(() => window.getSelection()?.removeAllRanges());
    await preview.click({ clickCount: 3 });
    expect(await notes.evaluate(() => window.getSelection()?.toString())).toContain(
      "Texto seleccionable",
    );
  } finally {
    await app.close();
  }
});
