import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, installTool, launchApp, shellPage } from "./helpers.ts";

for (const width of [760, 900]) {
  test(`mantiene el mínimo y separa marca, pestañas y aviso a ${width}px`, async () => {
    test.setTimeout(90_000);
    const directory = await mkdtemp(join(tmpdir(), "lensdesk-tabs-limit-"));
    const app = await launchApp();
    try {
      const shell = await shellPage(app);
      const window = await app.browserWindow(shell);
      await window.evaluate((browserWindow) => browserWindow.setSize(400, 300));
      const size = await window.evaluate((browserWindow) => browserWindow.getSize());
      expect(size[0]).toBeGreaterThanOrEqual(760);
      expect(size[1]).toBeGreaterThanOrEqual(520);
      await window.evaluate((browserWindow, width) => browserWindow.setSize(width, 520), width);
      await enableDeveloperMode(shell);
      for (let index = 0; index < 9; index++) {
        const source = join(directory, `tool-${index}`);
        await cp(resolve("tools/_template/dist"), source, { recursive: true });
        const manifestPath = join(source, "lensdesk.tool.json");
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        manifest.id = `tabs-test-${index}`;
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
      }
      for (const name of ["Herramientas", "Ajustes"]) {
        await shell.getByRole("button", { name, exact: true }).click();
        await expect
          .poll(() =>
            shell.locator("main").evaluate((page) => page.scrollWidth <= page.clientWidth),
          )
          .toBe(true);
      }
      for (let index = 0; index < 9; index++) {
        await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
        await shell.getByRole("button", { name: `Abrir Plantilla ${index}`, exact: true }).click();
      }
      await expect(shell.getByRole("tab")).toHaveCount(8);
      const notice = shell.locator("li[role=status]");
      await expect(notice).toBeVisible();
      const parts = [
        shell.locator("[data-brand]"),
        shell.getByRole("tablist"),
        notice,
        shell.getByRole("button", { name: "Herramientas", exact: true }),
        shell.getByRole("button", { name: "Ajustes", exact: true }),
      ];
      await expect
        .poll(async () => {
          const boxes = await Promise.all(parts.map((part) => part.boundingBox()));
          return boxes.every(
            (box, index) =>
              box &&
              box.width > 0 &&
              (index === 0 ||
                (!!boxes[index - 1] &&
                  (boxes[index - 1]?.x ?? 0) + (boxes[index - 1]?.width ?? 0) <= box.x)),
          );
        })
        .toBe(true);
      await expect(shell.locator("[data-brand] > span:visible")).toHaveText("LD");
      const listBox = await shell.getByRole("tablist").boundingBox();
      expect(listBox).not.toBeNull();
      for (const tab of await shell.getByRole("tab").all()) {
        const box = await tab.boundingBox();
        expect(box).not.toBeNull();
        if (box && listBox) {
          expect(box.width).toBeGreaterThanOrEqual(24);
          expect(box.x).toBeGreaterThanOrEqual(listBox.x);
          expect(box.x + box.width).toBeLessThanOrEqual(listBox.x + listBox.width);
        }
      }
      expect(
        await shell
          .getByRole("banner")
          .evaluate((header) => header.scrollWidth <= header.clientWidth),
      ).toBe(true);
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
