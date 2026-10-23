import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

const toolDir = resolve(import.meta.dirname, "../../tools/md-converter");

test("el Convertidor cabe en la ventana mínima con su barra de iconos", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-converter-min-"));
  const longFile = join(userDataDir, `${"informe-trimestral-de-ventas-".repeat(3)}final.html`);
  await copyFile(join(toolDir, "tests/fixtures/sample.html"), longFile);
  const app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("md-converter")] });
    await shell.getByRole("button", { name: "Herramientas" }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
    const tool = await toolPage(app, "md-converter");
    const window = await app.browserWindow(shell);
    await window.evaluate((browserWindow) => browserWindow.setContentSize(760, 520));
    await stubDialog(app, "open", {
      canceled: false,
      filePaths: [join(toolDir, "tests/fixtures/sample.csv"), longFile],
    });
    await tool.getByRole("button", { name: "Elegir archivos…" }).click();
    const queue = tool.getByRole("list", { name: "Cola de conversión" });
    await expect(queue.getByRole("img", { name: "Listo" })).toHaveCount(2);

    // Cada acción de la barra es un icono con su nombre.
    for (const name of ["Vista renderizada", "Markdown crudo"]) {
      await expect(tool.getByRole("tab", { name, exact: true })).toBeVisible();
    }
    for (const name of ["Copiar", "Guardar .md", "Guardar todos…"]) {
      await expect(tool.getByRole("button", { name, exact: true })).toBeVisible();
    }
    await expect(tool.getByRole("button", { name: "Borrar historial" })).toBeVisible();

    await expect
      .poll(() =>
        tool.evaluate(() => {
          const toolbar = document.querySelector(".preview-toolbar");
          return (
            document.documentElement.scrollWidth <= innerWidth &&
            !!toolbar &&
            toolbar.scrollWidth <= toolbar.clientWidth &&
            [...toolbar.querySelectorAll("button")].every(
              (button) => button.getBoundingClientRect().right <= innerWidth,
            )
          );
        }),
      )
      .toBe(true);
    const panel = await tool.locator(".queue-panel").boundingBox();
    expect(Math.round(panel?.width ?? 0)).toBe(216);
    await tool.screenshot({ path: test.info().outputPath("convertidor-min.png") });
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
