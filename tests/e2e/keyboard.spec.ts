import { expect, type Locator, type Page, test } from "@playwright/test";
import { launchApp, lenspkgPath, shellPage, stubDialog, toolPage } from "./helpers.ts";

async function tabTo(page: Page, target: Locator) {
  for (let count = 0; count < 80; count += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("El control no se alcanzó con Tab");
}

test("instala, escribe y cierra Notas usando solo el teclado", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    // Los atajos del menú nativo no reciben teclas simuladas: se llega a cada botón con Tab.
    const settings = shell.getByRole("button", { name: "Ajustes", exact: true });
    await tabTo(shell, settings);
    await shell.keyboard.press("Enter");
    const developer = shell.getByRole("switch", { name: "Modo desarrollador" });
    await expect(developer).toBeVisible();
    await tabTo(shell, developer);
    await shell.keyboard.press("Space");
    await expect(developer).toHaveAttribute("aria-checked", "true");
    const tools = shell.getByRole("button", { name: "Herramientas", exact: true });
    await tabTo(shell, tools);
    await shell.keyboard.press("Enter");
    const install = shell.getByRole("button", { name: "Agregar herramienta…" });
    await expect(install).toBeVisible();
    await stubDialog(app, "open", {
      canceled: false,
      filePaths: [lenspkgPath("notes")],
    });
    await tabTo(shell, install);
    await shell.keyboard.press("Enter");
    const open = shell.getByRole("button", { name: "Abrir Notas", exact: true });
    await expect(open).toBeVisible();
    await tabTo(shell, open);
    await shell.keyboard.press("Enter");
    const notes = await toolPage(app, "notes");
    const create = notes.getByRole("button", { name: "Nueva nota" }).first();
    await expect(create).toBeVisible();
    await tabTo(notes, create);
    await notes.keyboard.press("Enter");
    const editor = notes.getByRole("textbox", { name: "Editar" });
    await expect(editor).toBeVisible();
    await tabTo(notes, editor);
    for (const key of ["H", "o", "l", "a"]) await notes.keyboard.press(key);
    await expect(editor).toContainText("Hola");
    await notes.keyboard.press("Tab");
    await expect(editor).not.toBeFocused();
    await tabTo(shell, tools);
    await shell.keyboard.press("Enter");
    await expect(shell.getByRole("heading", { name: "Herramientas", exact: true })).toBeVisible();
    const close = shell.getByRole("button", { name: "Cerrar Notas" });
    await tabTo(shell, close);
    await shell.keyboard.press("Enter");
    await expect(shell.getByRole("tab", { name: "Notas", exact: true })).toHaveCount(0);
  } finally {
    await app.close();
  }
});
