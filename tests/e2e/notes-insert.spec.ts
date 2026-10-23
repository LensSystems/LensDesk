import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  shellPage,
  toolPage,
} from "./helpers.ts";

test("menú Insertar con clic derecho y teclado, conserva la selección y deshace en un paso", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    await enableDeveloperMode(shell);
    await installTool(app, shell, lenspkgPath("notes"), "Notas");
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const notes = await toolPage(app, "notes");
    await notes.getByRole("button", { name: "Nueva nota" }).first().click();
    const editor = notes.locator(".cm-content");
    await editor.fill("uno\ndos");
    await editor.press("ControlOrMeta+a");
    await notes.locator(".cm-line").first().click({ button: "right" });
    await notes.getByRole("menuitem", { name: "Insertar", exact: true }).click();
    const menu = notes.getByRole("menu", { name: "Insertar" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Contraseña…" })).toHaveAttribute(
      "data-disabled",
      "",
    );
    await menu.getByRole("menuitem", { name: "Lista con viñetas" }).click();
    await expect(editor).toHaveText("- uno- dos");
    await expect(editor).toBeFocused();
    await editor.press("ControlOrMeta+z");
    await expect(editor).toHaveText("unodos");
    await notes.locator(".cm-line").nth(1).click();
    await editor.press("End");
    await editor.press("Shift+F10");
    await expect(notes.getByRole("menu", { name: "Menú de edición" })).toBeVisible();
    await notes.keyboard.press("ArrowDown");
    await notes.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(editor).toBeFocused();
    await editor.press("Shift+F10");
    await notes.getByRole("menuitem", { name: "Insertar", exact: true }).click();
    await menu.getByRole("menuitem", { name: "Encabezado 2" }).click();
    await expect(notes.locator(".cm-line").first()).toHaveText("uno");
    await expect(notes.locator(".cm-line").nth(1)).toHaveText("## dos");
    // Clic derecho en otra línea: el cursor va allí y se inserta en esa línea.
    await notes.locator(".cm-line").first().click({ button: "right" });
    await notes.getByRole("menuitem", { name: "Insertar", exact: true }).click();
    await menu.getByRole("menuitem", { name: "Cita" }).click();
    await expect(notes.locator(".cm-line").first()).toHaveText("> uno");
    await expect(notes.locator(".cm-line").nth(1)).toHaveText("## dos");
  } finally {
    await app.close();
  }
});
