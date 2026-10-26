import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, installTool, launchApp, lenspkgPath, shellPage } from "./helpers.ts";

for (const width of [1280, 760]) {
  for (const theme of ["dark", "light"]) {
    test(`tarjetas y actualización a ${width}px en ${theme}`, async () => {
      const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-cards-"));
      const app = await launchApp({ userDataDir });
      try {
        const shell = await shellPage(app);
        const browserWindow = await app.browserWindow(shell);
        await browserWindow.evaluate(
          (window, width) => window.setSize(width, width === 760 ? 520 : 800),
          width,
        );
        await shell.emulateMedia({ reducedMotion: "no-preference" });
        await enableDeveloperMode(shell);
        await shell.evaluate(async (theme) => {
          await window.lensdeskHost.invoke("settings.set", { key: "theme", value: theme });
        }, theme);
        await installTool(app, shell, lenspkgPath("_template"));
        await installTool(app, shell, lenspkgPath("notes"), "Notas");
        await installTool(app, shell, lenspkgPath("md-converter"), "Convertidor");
        await expect(
          shell.getByRole("region", { name: "Cómo funciona la actualización de herramientas" }),
        ).toHaveCount(0);
        await app.evaluate(({ BrowserWindow }) => {
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("tools.updatesAvailable", {
              tools: [
                {
                  id: "md-converter",
                  version: "0.3.0",
                  url: "https://example.com/converter.lenspkg",
                },
              ],
            });
          }
        });
        await expect(shell.getByText("Versión 0.3.0 disponible", { exact: true })).toBeVisible();
        await expect(shell.getByRole("button", { name: "Descargar", exact: true })).toBeVisible();
        await expect(
          shell.getByRole("button", { name: "Instalar archivo…", exact: true }),
        ).toBeVisible();
        await expect(shell.getByRole("button", { name: /Actualizar a/ })).toHaveCount(0);
        const cards = shell.locator("main article");
        await expect(cards).toHaveCount(3);
        await expect
          .poll(() =>
            shell
              .locator(".ld-tool-update")
              .evaluate((element) =>
                element.getAnimations().every((animation) => animation.playState === "finished"),
              ),
          )
          .toBe(true);
        await expect
          .poll(async () => {
            const boxes = await cards.evaluateAll((cards) =>
              cards.map((card) => {
                const { x, y, width, height } = card.getBoundingClientRect();
                return { x, y, width, height };
              }),
            );
            const [a, b, c] = boxes;
            return Boolean(
              a &&
                b &&
                c &&
                (width === 760 ? c.y >= a.y + a.height : Math.abs(c.y - a.y) < 1) &&
                Math.abs(a.y - b.y) < 1 &&
                b.x >= a.x + a.width &&
                (width !== 760 || Math.abs(a.height - b.height) < 1),
            );
          })
          .toBe(true);
        await expect
          .poll(() =>
            shell.locator("main").evaluate((main) => main.scrollWidth <= main.clientWidth),
          )
          .toBe(true);
        if (width === 760) {
          await expect(
            shell
              .getByRole("button", { name: "Agregar herramienta…", exact: true })
              .locator("span:visible"),
          ).toHaveText("Agregar…");
          for (const description of await cards.locator("p[title]").all()) {
            await expect(description).toHaveAttribute("title", /.+/);
          }
        }
        const trigger = cards.first().getByRole("button", { name: /Acciones/ });
        // Se mide antes de abrir: con el menú abierto, el resto de la página queda oculto.
        const buttonBox = await trigger.boundingBox();
        await trigger.click();
        const menu = shell.getByRole("menu");
        await expect(menu).toBeVisible();
        await expect(menu).toHaveCSS("animation-duration", "0.14s");
        await expect(menu).toHaveCSS("animation-timing-function", "ease-out");
        expect(await menu.evaluate((element) => getComputedStyle(element).animationName)).not.toBe(
          "none",
        );
        // Esperar el reposo evita medir la escala intermedia de apertura.
        await menu.evaluate(async (element) => {
          await Promise.all(element.getAnimations().map((animation) => animation.finished));
        });
        expect(buttonBox).not.toBeNull();
        if (!buttonBox) throw new Error("No se encontró el botón del menú");
        const geometry = await menu.evaluate((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return {
            origin: style.transformOrigin.split(" ").map(Number.parseFloat),
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          };
        });
        const [originX, originY] = geometry.origin;
        if (originX === undefined || originY === undefined) {
          throw new Error("El menú no tiene un origen calculado de dos coordenadas");
        }
        const nearestX =
          buttonBox.x + buttonBox.width / 2 < geometry.x + geometry.width / 2 ? 0 : geometry.width;
        const nearestY =
          buttonBox.y + buttonBox.height / 2 < geometry.y + geometry.height / 2
            ? 0
            : geometry.height;
        expect(Math.abs(originX - nearestX)).toBeLessThan(1);
        expect(Math.abs(originY - nearestY)).toBeLessThan(1);
        expect(Math.abs(originX - geometry.width / 2)).toBeGreaterThan(1);
        expect(Math.abs(originY - geometry.height / 2)).toBeGreaterThan(1);
        await shell.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);
        await shell.screenshot({ path: test.info().outputPath(`tools-${width}-${theme}.png`) });
      } finally {
        await app.close().catch(() => undefined);
        await rm(userDataDir, { recursive: true, force: true });
      }
    });
  }
}
