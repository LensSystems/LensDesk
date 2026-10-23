import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { enableDeveloperMode, installTool, launchApp, shellPage } from "./helpers.ts";

async function expectCentered(shell: Page) {
  await expect
    .poll(() =>
      shell.getByRole("tablist").evaluate((list) => {
        const box = list.getBoundingClientRect();
        return Math.abs(box.left + box.width / 2 - document.documentElement.clientWidth / 2);
      }),
    )
    .toBeLessThanOrEqual(1);
}

async function expectClearSides(shell: Page) {
  await expect
    .poll(() =>
      shell.getByRole("tablist").evaluate((list) => {
        const box = list.getBoundingClientRect();
        const brand = document.querySelector("[data-brand]")?.getBoundingClientRect();
        const buttons = [...document.querySelectorAll<HTMLElement>("header button")].filter(
          (button) => !list.contains(button),
        );
        return (
          !!brand &&
          brand.right <= box.left &&
          buttons.every((button) => {
            const rect = button.getBoundingClientRect();
            return rect.left >= box.right && rect.right <= document.documentElement.clientWidth;
          })
        );
      }),
    )
    .toBe(true);
  await expect(shell.getByRole("button", { name: "Herramientas", exact: true })).toBeVisible();
  await expect(shell.getByRole("button", { name: "Ajustes", exact: true })).toBeVisible();
}

for (const width of [1280, 760]) {
  test(`centra las pestañas y protege los laterales a ${width}px incluso durante el arrastre`, async () => {
    test.setTimeout(90_000);
    const directory = await mkdtemp(join(tmpdir(), "lensdesk-tabs-center-"));
    const app = await launchApp();
    try {
      const shell = await shellPage(app);
      const window = await app.browserWindow(shell);
      await window.evaluate(
        (browserWindow, width) => browserWindow.setContentSize(width, 800),
        width,
      );
      await enableDeveloperMode(shell);
      for (let index = 0; index < 8; index++) {
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
        await shell.getByRole("button", { name: `Abrir Plantilla ${index}`, exact: true }).click();
        if (index === 2 || index === 7) {
          await expect(shell.getByRole("tab")).toHaveCount(index + 1);
          await expectCentered(shell);
          await expectClearSides(shell);
        }
        if ([0, 4, 7].includes(index)) {
          // Cada aviso usa otra versión: la descartada antes ya no vuelve a mostrarse.
          await app.evaluate(
            ({ BrowserWindow }, version) => {
              BrowserWindow.getAllWindows()[0]?.webContents.send("update.available", {
                version,
                html_url: `https://github.com/LensSystems/LensDesk/releases/tag/v${version}`,
              });
            },
            `0.3.${index + 1}`,
          );
          const notice = shell.locator("[data-notice-capsule]");
          await expect(notice).toBeVisible();
          await expect
            .poll(() =>
              shell.getByRole("tablist").evaluate((list) => {
                const tabs = list.getBoundingClientRect();
                const brand = document.querySelector("[data-brand]")?.getBoundingClientRect();
                const capsule = document
                  .querySelector("[data-notice-capsule]")
                  ?.getBoundingClientRect();
                const tools = [...document.querySelectorAll("header button")]
                  .find((button) => button.getAttribute("aria-label") === "Herramientas")
                  ?.getBoundingClientRect();
                return (
                  !!brand &&
                  !!capsule &&
                  !!tools &&
                  Math.abs(tools.left - capsule.right - 8) <= 1 &&
                  tabs.left >= brand.right + 11 &&
                  capsule.left >= tabs.right + 11 &&
                  Math.abs(tabs.left - brand.right - (capsule.left - tabs.right)) <= 1 &&
                  document.documentElement.scrollWidth <= document.documentElement.clientWidth
                );
              }),
            )
            .toBe(true);
          const text = notice.locator("[data-notice-text]");
          if (width === 1280 && index === 7) {
            await expect(text).toHaveAttribute("data-overflow", "false");
          }
          // La barra se recoloca con una transición: se mide cuando ya está quieta.
          await shell.waitForTimeout(400);
          const overflow = (await text.getAttribute("data-overflow")) === "true";
          if (overflow) {
            await expect(text).toHaveAttribute("data-moving", "true");
            await notice.hover();
            await expect(text).toHaveAttribute("data-paused", "true");
            const action = notice.getByRole("button", { name: "Descargar instalador" });
            await action.focus();
            await shell.mouse.move(0, 200);
            await expect(text).toHaveAttribute("data-paused", "true");
          } else {
            await shell.waitForTimeout(1600);
            await expect(text).toHaveAttribute("data-moving", "false");
          }
          await shell.emulateMedia({ reducedMotion: "reduce" });
          await expect(text).toHaveAttribute("data-moving", "false");
          await shell.screenshot({
            path: test.info().outputPath(`aviso-${width}-${index + 1}.png`),
          });
          await notice.getByRole("button", { name: "Descartar", exact: true }).click();
          await shell.emulateMedia({ reducedMotion: "no-preference" });
          await expectCentered(shell);
        }
      }
      const tabs = shell.getByRole("tab");
      const first = await tabs.first().boundingBox();
      const last = await tabs.last().boundingBox();
      if (!first || !last) throw new Error("No se encontraron las pestañas");
      await shell.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
      await shell.mouse.down();
      try {
        await shell.mouse.move(first.x + first.width / 2, first.y + first.height / 2, {
          steps: 12,
        });
        await expect(shell.getByRole("tablist").locator(".border-dashed")).toHaveCount(1);
        await expectCentered(shell);
        await expectClearSides(shell);
      } finally {
        await shell.mouse.up();
      }
      await expectCentered(shell);
      await expectClearSides(shell);
      expect(
        await shell.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
