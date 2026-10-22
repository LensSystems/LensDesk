import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  shellPage,
  toolPage,
} from "./helpers.ts";

test("Notas permite elegir notas sin desbordes a 760 × 520", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    await enableDeveloperMode(shell);
    await installTool(app, shell, lenspkgPath("notes"), "Notas");
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const tool = await toolPage(app, "notes");
    const window = await app.browserWindow(shell);
    await window.evaluate((browserWindow) => browserWindow.setSize(760, 520));
    const rail = tool.locator(".sidebar-rail");
    await expect(rail).toBeVisible();
    await rail.getByRole("button", { name: "Nueva nota", exact: true }).click();
    const title = "Una nota con título muy largo ".repeat(6).trim();
    await tool.getByRole("textbox", { name: "Título de la nota" }).fill(title);
    await tool.getByRole("textbox", { name: "Título de la nota" }).press("Enter");
    await tool.locator(".cm-content").fill("Contenido de prueba ".repeat(100));
    const checkOverflow = async () => {
      for (const selector of [
        ".notes-sidebar",
        ".editor-toolbar",
        ".editor-panel",
        ".code-editor",
      ]) {
        await expect
          .poll(() =>
            tool
              .locator(selector)
              .evaluate((element) => element.scrollWidth <= element.clientWidth),
          )
          .toBe(true);
      }
    };
    await checkOverflow();
    const toggle = rail.getByRole("button", { name: "Mostrar lista de notas" });
    await toggle.click();
    const dialog = tool.getByRole("dialog", { name: "Lista de notas" });
    await expect(dialog).toBeVisible();
    // El panel queda entero dentro de la ventana (no centrado ni cortado).
    await expect(dialog).toBeInViewport({ ratio: 1 });
    for (const selector of [".note-list", "nav"]) {
      await expect
        .poll(() =>
          dialog
            .locator(selector)
            .evaluate((element) => element.scrollWidth <= element.clientWidth),
        )
        .toBe(true);
    }
    await dialog.getByRole("button", { name: title, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(tool.getByRole("heading", { name: title })).toBeVisible();
    await checkOverflow();
    await toggle.click();
    await tool.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(toggle).toBeFocused();

    // Si la ventana se ensancha con el panel abierto, al cerrar el foco va a la lista amplia.
    await toggle.click();
    await expect(dialog).toBeVisible();
    await window.evaluate((browserWindow) => browserWindow.setSize(1280, 800));
    await expect(rail).toBeHidden();
    await tool.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect
      .poll(() =>
        tool.evaluate(() => {
          const active = document.activeElement;
          return Boolean(active?.closest(".sidebar-wide")) && active?.checkVisibility() === true;
        }),
      )
      .toBe(true);

    // Igual desde Papelera, donde la búsqueda está deshabilitada.
    await window.evaluate((browserWindow) => browserWindow.setSize(760, 520));
    await expect(rail).toBeVisible();
    await rail.getByRole("button", { name: "Papelera", exact: true }).click();
    await expect(dialog).toBeVisible();
    await window.evaluate((browserWindow) => browserWindow.setSize(1280, 800));
    await expect(rail).toBeHidden();
    await tool.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect
      .poll(() =>
        tool.evaluate(() => {
          const active = document.activeElement as HTMLElement | null;
          return (
            Boolean(active?.closest(".sidebar-wide")) &&
            active?.checkVisibility() === true &&
            !(active as HTMLInputElement).disabled
          );
        }),
      )
      .toBe(true);
  } finally {
    await app.close();
  }
});
