import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  launchApp,
  lenspkgPath,
  shellPage,
  stubDialog,
  toolPage,
} from "./helpers.ts";

for (const middle of [false, true]) {
  test(
    middle ? "el clic central cierra la pestaña" : "el cierre aparece al pasar el ratón y cierra",
    async () => {
      const app = await launchApp();
      try {
        const shell = await shellPage(app);
        await enableDeveloperMode(shell);
        await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("notes")] });
        await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
        await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
        await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
        await toolPage(app, "notes");
        const tab = shell.getByRole("tab", { name: "Notas", exact: true });
        const close = shell.getByRole("button", { name: "Cerrar Notas", exact: true });
        await expect(tab).toBeVisible();
        await expect(close.locator("svg")).toHaveAttribute("width", "13");
        await expect(close.locator("svg")).toHaveAttribute("height", "13");
        if (middle) {
          await tab.click({ button: "middle" });
        } else {
          await shell.mouse.move(0, 0);
          await shell.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await expect(close).toHaveCSS("opacity", "0");
          // Tras un clic con el ratón la pestaña conserva el foco, pero la × solo vuelve con
          // el ratón encima o con foco de teclado.
          await tab.click();
          await shell.mouse.move(0, 0);
          await expect(close).toHaveCSS("opacity", "0");
          await shell.keyboard.press("Tab");
          await shell.keyboard.press("Shift+Tab");
          await expect(close).toHaveCSS("opacity", "1");
          await shell.mouse.move(0, 0);
          await tab.hover();
          await expect(close).toHaveCSS("opacity", "1");
          await close.click();
        }
        await expect(tab).toHaveCount(0);
        await expect(close).toHaveCount(0);
      } finally {
        await app.close();
      }
    },
  );
}
