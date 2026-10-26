import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, installTool, launchApp, shellPage } from "./helpers.ts";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`apila avisos y permite desplegarlos con movimiento ${reducedMotion}`, async () => {
    test.setTimeout(120_000);
    const directory = await mkdtemp(join(tmpdir(), "lensdesk-notices-"));
    const app = await launchApp();
    try {
      const shell = await shellPage(app);
      await shell.emulateMedia({ reducedMotion });
      const window = await app.browserWindow(shell);
      await window.evaluate((browserWindow) => browserWindow.setContentSize(760, 520));
      await enableDeveloperMode(shell);
      for (let index = 0; index < 9; index++) {
        const source = join(directory, `tool-${index}`);
        await cp(resolve("tools/_template/dist"), source, { recursive: true });
        const manifestPath = join(source, "lensdesk.tool.json");
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        manifest.id = `center-test-${index}`;
        manifest.name = { es: `Plantilla ${index}`, en: `Template ${index}` };
        await writeFile(manifestPath, JSON.stringify(manifest));
        const outFile = join(directory, `tool-${index}.lenspkg`);
        execFileSync(process.execPath, [
          resolve("packages/lenspkg/src/cli.ts"),
          "pack",
          source,
          "--out",
          outFile,
          "--unsigned",
        ]);
        await installTool(app, shell, outFile, `Plantilla ${index}`);
        if (index === 8) {
          await app.evaluate(({ BrowserWindow }) => {
            BrowserWindow.getAllWindows()[0]?.webContents.send("update.available", {
              version: "9.9.9",
              html_url: "https://github.com/LensSystems/LensDesk/releases/tag/v9.9.9",
            });
          });
          await expect(shell.getByRole("button", { name: "Ir a Ajustes" })).toBeVisible();
        }
        await shell.getByRole("button", { name: `Abrir Plantilla ${index}`, exact: true }).click();
      }
      await shell.mouse.move(0, 200);
      const stack = shell.locator("[data-notice-stack]");
      const front = stack.locator(".ld-notice-front");
      const back = stack.locator("[data-notice-back]");
      await expect(front).toContainText("Se cerró");
      await expect(back).toHaveAttribute("inert", "");
      // Se mide con la entrada ya terminada (empieza a escala 0,97).
      await front.evaluate((node) =>
        Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
      );
      const reserved = await stack.boundingBox();
      const capsule = await front.boundingBox();
      expect(Math.abs((reserved?.width ?? 0) - (capsule?.width ?? 100))).toBeLessThan(1);
      // El de detrás asoma 7 px por la izquierda del de delante.
      const peek = await back.boundingBox();
      expect(Math.abs((capsule?.x ?? 0) - (peek?.x ?? 100) - 7)).toBeLessThan(1);
      await expect.poll(() => back.evaluate((node) => getComputedStyle(node).opacity)).toBe("0.6");
      await front.hover();
      await expect(back).not.toHaveAttribute("inert", "");
      await expect.poll(() => back.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
      if (reducedMotion === "reduce") {
        expect(await back.evaluate((node) => getComputedStyle(node).transitionDuration)).toBe("0s");
      }
      await shell.waitForTimeout(5200);
      await expect(front).toContainText("Se cerró");
      await shell.mouse.move(0, 200);
      await expect(stack.locator("[data-notice-back]")).toHaveCount(0, { timeout: 6500 });
      await expect(shell.getByRole("button", { name: "Ir a Ajustes" })).toBeVisible();
      // Otra apertura vuelve a generar el temporal para probar la acción desplegada.
      await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
      await shell.getByRole("button", { name: "Abrir Plantilla 0", exact: true }).click();
      await stack.hover();
      await shell.getByRole("button", { name: "Ir a Ajustes" }).click();
      await expect(shell.getByRole("heading", { name: "Ajustes", exact: true })).toBeVisible();
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
