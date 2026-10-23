import { expect, test } from "@playwright/test";
import { launchApp, shellPage } from "./helpers.ts";

const release = "https://github.com/LensSystems/LensDesk/releases";

for (const width of [1100, 760]) {
  test(`el aviso de versión cabe en la cabecera a ${width}px`, async () => {
    const app = await launchApp();
    try {
      const shell = await shellPage(app);
      const window = await app.browserWindow(shell);
      await window.evaluate((browserWindow, width) => browserWindow.setSize(width, 600), width);
      const banner = shell.locator("header [role=status]").filter({ hasText: "0.3.0" });
      // Simula el aviso que emite la comprobación de versiones, sin red. Se reenvía hasta que la
      // interfaz ya escucha los eventos (justo al arrancar aún puede no estar suscrita).
      await expect(async () => {
        await app.evaluate(({ BrowserWindow }, release) => {
          BrowserWindow.getAllWindows()[0]?.webContents.send("update.available", {
            version: "0.3.0",
            html_url: `${release}/tag/v0.3.0`,
            installerUrl: `${release}/download/v0.3.0/LensDesk-0.3.0-mac-arm64.dmg`,
          });
        }, release);
        await expect(banner).toBeVisible({ timeout: 500 });
      }).toPass();
      const parts = [
        banner,
        shell.getByRole("button", { name: "Herramientas", exact: true }),
        shell.getByRole("button", { name: "Ajustes", exact: true }),
      ];
      const boxes = [];
      for (const part of parts) {
        const box = await part.boundingBox();
        if (!box) throw new Error("Falta un elemento de la cabecera");
        boxes.push(box);
      }
      for (let index = 1; index < boxes.length; index++) {
        const previous = boxes[index - 1];
        const current = boxes[index];
        if (previous && current) expect(previous.x + previous.width).toBeLessThanOrEqual(current.x);
      }
      for (const name of ["Ir a Ajustes", "Descartar"])
        await expect(banner.getByRole("button", { name, exact: true })).toBeVisible();
      expect(
        await shell.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
      await shell.screenshot({ path: test.info().outputPath(`aviso-${width}.png`) });
    } finally {
      await app.close();
    }
  });
}
