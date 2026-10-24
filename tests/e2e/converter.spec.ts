import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

const toolDir = resolve(import.meta.dirname, "../../tools/md-converter");

test("el Convertidor muestra una tabla GFM para HTML y CSV", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-converter-e2e-"));
  const pkg = lenspkgPath("md-converter");
  const app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [pkg] });
    await shell.getByRole("button", { name: "Herramientas" }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await shell.getByText("Convertidor", { exact: true }).waitFor();
    await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
    const tool = await toolPage(app, "md-converter");
    const save = tool.getByRole("button", { name: "Guardar .md", exact: true });
    await expect(save.locator(".normal-label")).toBeVisible();
    await save.hover();
    await tool.waitForTimeout(300);
    await expect(tool.locator(".ld-tooltip")).toHaveCount(0);
    const close = shell.getByRole("button", { name: "Cerrar Convertidor", exact: true });
    await shell.getByRole("tab", { name: "Convertidor", exact: true }).hover();
    await close.hover();
    await shell.waitForTimeout(300);
    await expect(shell.locator(".ld-tooltip")).toHaveCount(0);

    await stubDialog(app, "open", {
      canceled: false,
      filePaths: [
        join(toolDir, "tests/fixtures/sample.html"),
        join(toolDir, "tests/fixtures/sample.csv"),
      ],
    });
    await tool.getByRole("button", { name: "Elegir archivos…" }).click();
    const queue = tool.getByRole("list", { name: "Cola de conversión" });
    await expect(queue.getByRole("listitem").filter({ hasText: "sample.csv" })).toContainText(
      "Listo",
    );
    await expect(queue.getByRole("listitem").filter({ hasText: "sample.html" })).toContainText(
      "Listo",
    );
    await tool.getByRole("tab", { name: "Markdown crudo" }).click();
    const raw = tool.getByRole("tabpanel", { name: "Markdown crudo" });

    await tool.getByRole("button", { name: "sample.html", exact: true }).click();
    await expect(raw).toContainText("| Nombre | Valor |");
    await expect(raw).toContainText("| --- | --- |");
    await expect(raw).toContainText("| Ada | 1 |");

    await tool.getByRole("button", { name: "sample.csv", exact: true }).click();
    await expect(raw).toContainText("| Nombre | Detalle |");
    await expect(raw).toContainText("| --- | --- |");
    await expect(raw).toContainText("| Ada | valor \\| uno |");
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});

test("un nombre de archivo largo no ensancha la cola", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-converter-e2e-"));
  const pkg = lenspkgPath("md-converter");
  const name = `${"documento-con-un-nombre-muy-largo-".repeat(6)}final.html`;
  const longFile = join(userDataDir, name);
  await copyFile(join(toolDir, "tests/fixtures/sample.html"), longFile);
  const app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [pkg] });
    await shell.getByRole("button", { name: "Herramientas" }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await shell.getByText("Convertidor", { exact: true }).waitFor();
    await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
    const tool = await toolPage(app, "md-converter");

    await stubDialog(app, "open", { canceled: false, filePaths: [longFile] });
    await tool.getByRole("button", { name: "Elegir archivos…" }).click();
    const queue = tool.getByRole("list", { name: "Cola de conversión" });
    const row = queue.getByRole("listitem").filter({ hasText: "Listo" });
    await expect(row).toBeVisible();

    const rowBox = await row.boundingBox();
    const preview = await tool.getByRole("tab", { name: "Markdown crudo" }).boundingBox();
    expect(rowBox && preview).toBeTruthy();
    if (!rowBox || !preview) return;
    // La fila y su nombre permanecen dentro de la cola.
    expect(rowBox.x + rowBox.width).toBeLessThan(preview.x);
    await expect(queue.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
    expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
