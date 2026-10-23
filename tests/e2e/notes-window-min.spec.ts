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
    await window.evaluate((browserWindow) => browserWindow.setContentSize(760, 520));
    const rail = tool.locator(".sidebar-rail");
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("button")).toHaveCount(3);
    await rail.getByRole("button", { name: "Nueva nota", exact: true }).click();
    const title = "Una nota con título muy largo ".repeat(6).trim();
    await tool.getByRole("textbox", { name: "Título de la nota" }).fill(title);
    await tool.getByRole("textbox", { name: "Título de la nota" }).press("Enter");
    await tool.locator(".cm-content").fill("Contenido de prueba ".repeat(100));
    const checkOverflow = async () => {
      await expect
        .poll(() => tool.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
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
    await tool.screenshot({ path: test.info().outputPath("notes-min-closed.png") });
    const toggle = rail.getByRole("button", { name: "Mostrar lista de notas" });
    await toggle.click();
    const dialog = tool.getByRole("dialog", { name: "Notas", exact: true });
    await expect(dialog).toBeVisible();
    // El panel queda entero dentro de la ventana (no centrado ni cortado).
    await expect(dialog).toBeInViewport({ ratio: 1 });
    // Se captura cuando la entrada del menú y del fondo ya terminó.
    await expect
      .poll(() =>
        tool.evaluate(() =>
          document.getAnimations().every((animation) => animation.playState !== "running"),
        ),
      )
      .toBe(true);
    await tool.screenshot({ path: test.info().outputPath("notes-min-open.png") });
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    if (!bounds) throw new Error("El menú no tiene dimensiones");
    await tool.mouse.click(bounds.x + bounds.width + 24, bounds.y + 40);
    await expect(dialog).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await expect(dialog).toBeVisible();
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
    await window.evaluate((browserWindow) => browserWindow.setContentSize(1280, 800));
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
    await window.evaluate((browserWindow) => browserWindow.setContentSize(760, 520));
    await expect(rail).toBeVisible();
    await toggle.click();
    await dialog.getByRole("radio", { name: "Papelera", exact: true }).click();
    await expect(dialog).toBeVisible();
    await window.evaluate((browserWindow) => browserWindow.setContentSize(1280, 800));
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
