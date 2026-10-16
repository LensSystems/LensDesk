import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, stubDialog, toolPage } from "./helpers.ts";

const toolDir = resolve(import.meta.dirname, "../../tools/md-converter");

test("el Convertidor muestra una tabla GFM para HTML y CSV", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-converter-e2e-"));
  const pkg = join(toolDir, "dist/md-converter-0.1.0.lenspkg");
  const app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [pkg] });
    await shell.getByRole("button", { name: "Herramientas" }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await shell.getByText("Convertidor", { exact: true }).waitFor();
    await shell.getByRole("button", { name: "Convertidor", exact: true }).click();
    const tool = await toolPage(app, "md-converter");

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
