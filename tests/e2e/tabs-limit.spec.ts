import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, installTool, launchApp, shellPage } from "./helpers.ts";

for (const width of [1280, 900]) {
  test(`limita a ocho pestañas, restaura la posición y no desborda a ${width}px`, async () => {
    test.setTimeout(90_000);
    const directory = await mkdtemp(join(tmpdir(), "lensdesk-tabs-limit-"));
    const app = await launchApp();
    try {
      const shell = await shellPage(app);
      const window = await app.browserWindow(shell);
      await window.evaluate((browserWindow, width) => browserWindow.setSize(width, 800), width);
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
      for (let index = 0; index < 8; index++) {
        await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
        await shell.getByRole("button", { name: `Abrir Plantilla ${index}`, exact: true }).click();
      }
      await expect(shell.getByRole("tab")).toHaveCount(8);
      await shell.getByRole("tab", { name: "Plantilla 0", exact: true }).click();
      await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
      await shell.getByRole("button", { name: "Abrir Plantilla 8", exact: true }).click();
      await expect(shell.getByRole("tab")).toHaveCount(8);
      await expect(shell.getByRole("tab", { name: "Plantilla 1", exact: true })).toHaveCount(0);
      await expect(shell.getByRole("tab", { name: "Plantilla 0", exact: true })).toBeVisible();
      await expect(shell.locator("li[role=status]")).toContainText(
        "Se cerró Plantilla 1 para no superar 8 pestañas.",
      );
      const notice = await shell.locator("li[role=status]").boundingBox();
      const header = await shell.getByRole("banner").boundingBox();
      expect(notice).not.toBeNull();
      expect(header).not.toBeNull();
      if (notice && header) {
        expect(notice.y).toBeGreaterThanOrEqual(header.y);
        expect(notice.y + notice.height).toBeLessThanOrEqual(header.y + header.height);
      }
      const list = shell.getByRole("tablist");
      await expect
        .poll(async () => {
          const noticeBox = await shell.locator("li[role=status]").boundingBox();
          const listBox = await list.boundingBox();
          return !!noticeBox && !!listBox && listBox.x + listBox.width <= noticeBox.x;
        })
        .toBe(true);
      // Tampoco tapa los botones de la derecha ni desborda la página.
      const noticeBox = await shell.locator("li[role=status]").boundingBox();
      const toolsBox = await shell
        .getByRole("button", { name: "Herramientas", exact: true })
        .boundingBox();
      expect(noticeBox && toolsBox && noticeBox.x + noticeBox.width <= toolsBox.x).toBe(true);
      expect(
        await shell.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
      const activeName = shell.locator("[role=tab][aria-selected=true] [data-tab-name]");
      await expect(activeName).toHaveText("Plantilla 8");
      expect(
        await activeName.evaluate((name) => {
          const rect = name.getBoundingClientRect();
          const listRect = name.closest("[role=tablist]")?.getBoundingClientRect();
          return (
            !!listRect &&
            rect.width > 1 &&
            rect.height > 1 &&
            rect.left >= listRect.left &&
            rect.right <= listRect.right &&
            name.scrollWidth <= name.clientWidth
          );
        }),
      ).toBe(true);
      const compactTabs = shell.locator("[role=tab][aria-selected=false]");
      const compactBoxes = await compactTabs.evaluateAll((tabs) =>
        tabs.map((tab) => {
          const rect = tab.getBoundingClientRect();
          return { x: rect.x, width: rect.width, height: rect.height };
        }),
      );
      for (const box of compactBoxes) {
        expect(box.width).toBe(30);
        expect(box.height).toBe(30);
      }
      const [first, second] = compactBoxes;
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      if (first && second) expect(second.x - first.x - 30).toBe(4);
      await shell.getByRole("button", { name: "Deshacer", exact: true }).click();
      await expect(shell.getByRole("tab")).toHaveCount(8);
      await expect(shell.getByRole("tab").nth(1)).toHaveAccessibleName("Plantilla 1");
      await expect(shell.getByRole("tab", { name: "Plantilla 2", exact: true })).toHaveCount(0);
      expect(
        await shell.getByRole("tablist").evaluate((list) => list.scrollWidth <= list.clientWidth),
      ).toBe(true);
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
