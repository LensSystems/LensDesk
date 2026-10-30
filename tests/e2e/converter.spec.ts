import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

const toolDir = resolve(import.meta.dirname, "../../tools/md-converter");

for (const theme of ["light", "dark"] as const) {
  for (const accent of ["blue", "green"] as const) {
    for (const outcome of ["stopped", "failed"] as const) {
      test(`Guardar todos parcial ${outcome}/${theme}/${accent}`, async () => {
        const profile = await mkdtemp(join(tmpdir(), "lensdesk-save-all-"));
        const app = await launchApp({ userDataDir: profile });
        try {
          const shell = await app.firstWindow();
          await enableDeveloperMode(shell);
          await shell
            .getByRole("radiogroup", { name: "Tema", exact: true })
            .getByRole("radio", { name: theme === "light" ? "Claro" : "Oscuro", exact: true })
            .click();
          await shell
            .getByRole("radiogroup", { name: "Color de acento", exact: true })
            .getByRole("radio", { name: accent === "blue" ? "Azul" : "Verde", exact: true })
            .click();
          await stubDialog(app, "open", {
            canceled: false,
            filePaths: [lenspkgPath("md-converter")],
          });
          await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
          await shell.getByRole("button", { name: "Agregar herramienta…", exact: true }).click();
          await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
          const tool = await toolPage(app, "md-converter");
          const window = await app.browserWindow(shell);
          await window.evaluate((browserWindow) => browserWindow.setContentSize(760, 520));
          const inputs: string[] = [];
          for (const name of ["a.html", "b.html", "c.html"]) {
            const file = join(profile, name);
            await copyFile(join(toolDir, "tests/fixtures/sample.html"), file);
            inputs.push(file);
          }
          await stubDialog(app, "open", { canceled: false, filePaths: inputs });
          await tool.getByRole("button", { name: "Elegir archivos…", exact: true }).click();
          const queue = tool.getByRole("list", { name: "Cola de conversión" });
          await expect(queue.getByRole("img", { name: "Listo", exact: true })).toHaveCount(3);
          await app.evaluate(
            ({ dialog }, args) => {
              const scope = globalThis as typeof globalThis & { saveAllDialogCount: number };
              scope.saveAllDialogCount = 0;
              Object.defineProperty(dialog, "showSaveDialog", {
                configurable: true,
                value: async () => {
                  const index = scope.saveAllDialogCount++;
                  if (index === 1 && args.outcome === "stopped") return { canceled: true };
                  return {
                    canceled: false,
                    filePath:
                      index === 0 ? args.first : index === 1 ? args.failed : args.unexpected,
                  };
                },
              });
            },
            {
              outcome,
              first: join(profile, "a.md"),
              failed: join(profile, "missing", "b.md"),
              unexpected: join(profile, "unexpected.md"),
            },
          );
          const all = tool.getByRole("button", { name: "Guardar todos…", exact: true });
          await all.focus();
          await all.press("Enter");
          const result = tool
            .getByRole(outcome === "stopped" ? "status" : "alert")
            .filter({ hasText: "Se guardaron 1 de 3 archivos." });
          await expect(result).toBeVisible();
          if (outcome === "stopped") {
            await expect(result).toContainText("Guardado detenido.");
            await expect(tool.getByRole("alert")).toHaveCount(0);
          } else
            await expect(result).toContainText(
              "No se pudieron guardar todos los archivos Markdown.",
            );
          expect(
            await app.evaluate(
              () =>
                (globalThis as typeof globalThis & { saveAllDialogCount: number })
                  .saveAllDialogCount,
            ),
          ).toBe(2);
          expect((await readFile(join(profile, "a.md"), "utf8")).length).toBeGreaterThan(0);
          await expect(queue.getByRole("listitem")).toHaveCount(3);
          await expect(
            queue.getByRole("img", { name: "Archivo guardado", exact: true }),
          ).toHaveCount(1);
          await expect(all).toHaveAttribute("aria-busy", "false");
          await expect(all).toHaveAttribute("aria-disabled", "false");
          await expect(all).toBeFocused();
          await tool.screenshot({
            path: test.info().outputPath(`guardar-lote-${outcome}-compacto.png`),
          });
          await tool.getByRole("button", { name: "b.html", exact: true }).click();
          await stubDialog(app, "save", {
            canceled: false,
            filePath: join(profile, "recovered.md"),
          });
          await tool.getByRole("button", { name: "Guardar .md", exact: true }).click();
          await expect(
            queue.getByRole("img", { name: "Archivo guardado", exact: true }),
          ).toHaveCount(2);
          expect((await readFile(join(profile, "recovered.md"), "utf8")).length).toBeGreaterThan(0);
          await expect(queue.getByRole("listitem")).toHaveCount(3);
        } finally {
          await app.close().catch(() => undefined);
          await rm(profile, { recursive: true, force: true });
        }
      });
    }
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const accent of ["blue", "green"] as const) {
    for (const width of [760, 1280]) {
      test(`feedback y cola mixta del Convertidor ${theme}/${accent}/${width}`, async () => {
        const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-converter-feedback-"));
        const app = await launchApp({ userDataDir });
        try {
          const shell = await app.firstWindow();
          await enableDeveloperMode(shell);
          await shell
            .getByRole("radiogroup", { name: "Tema", exact: true })
            .getByRole("radio", { name: theme === "light" ? "Claro" : "Oscuro", exact: true })
            .click();
          await shell
            .getByRole("radiogroup", { name: "Color de acento", exact: true })
            .getByRole("radio", { name: accent === "blue" ? "Azul" : "Verde", exact: true })
            .click();
          await stubDialog(app, "open", {
            canceled: false,
            filePaths: [lenspkgPath("md-converter")],
          });
          await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
          await shell.getByRole("button", { name: "Agregar herramienta…", exact: true }).click();
          await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
          const tool = await toolPage(app, "md-converter");
          const window = await app.browserWindow(shell);
          await window.evaluate((browserWindow, size) => browserWindow.setContentSize(...size), [
            width,
            width === 760 ? 520 : 800,
          ] as [number, number]);
          await app.evaluate(({ ipcMain }) => {
            const handlers = (
              ipcMain as unknown as {
                _invokeHandlers: Map<
                  string,
                  (event: Electron.IpcMainInvokeEvent, channel: string, payload: unknown) => unknown
                >;
              }
            )._invokeHandlers;
            const original = handlers.get("lensdesk:tool-invoke");
            if (!original) throw new Error("Falta el receptor de herramientas");
            let rejectCopy = true;
            ipcMain.removeHandler("lensdesk:tool-invoke");
            ipcMain.handle(
              "lensdesk:tool-invoke",
              async (event, channel: string, payload: unknown) => {
                const request = payload as { params?: { name?: string } };
                if (channel === "backend.invoke" && request.params?.name === "error.html")
                  return {
                    ok: false,
                    error: { code: "E_UNSUPPORTED_FORMAT", message: "Synthetic failure" },
                  };
                if (channel === "backend.invoke" && request.params?.name === "converting.html")
                  return new Promise(() => {});
                if (channel === "ui.copyText" && rejectCopy) {
                  rejectCopy = false;
                  return {
                    ok: false,
                    error: { code: "E_INTERNAL", message: "Synthetic copy failure" },
                  };
                }
                return original(event, channel, payload);
              },
            );
          });
          const names = [
            "done.html",
            "error.html",
            "converting.html",
            "queued.html",
            "cancelled.html",
          ];
          const files: string[] = [];
          for (const name of names) {
            const file = join(userDataDir, name);
            await copyFile(join(toolDir, "tests/fixtures/sample.html"), file);
            files.push(file);
          }
          await stubDialog(app, "open", { canceled: false, filePaths: files });
          await tool.getByRole("button", { name: "Elegir archivos…", exact: true }).click();
          const queue = tool.getByRole("list", { name: "Cola de conversión" });
          for (const [filename, state] of [
            ["done.html", "Listo"],
            ["error.html", "Error"],
          ] as const) {
            const row = queue.getByRole("listitem").filter({ hasText: filename });
            await expect(row).toHaveCount(1);
            await expect(row).toContainText(state);
            if (width === 760)
              await expect(row.getByRole("img", { name: state, exact: true })).toBeVisible();
            else await expect(row.getByText(state, { exact: true })).toBeVisible();
          }
          await expect(
            queue
              .getByRole("listitem")
              .filter({ hasText: "converting.html" })
              .getByRole("progressbar"),
          ).toHaveCount(1);
          await tool
            .getByRole("button", { name: "Cancelar conversión de cancelled.html", exact: true })
            .click();
          await expect(
            queue.getByRole("listitem").filter({ hasText: "cancelled.html" }),
          ).toContainText("Cancelado");
          await expect(
            queue.getByRole("listitem").filter({ hasText: "queued.html" }),
          ).toContainText("En cola");
          await expect(
            tool.getByRole("heading", { name: "Archivos · 5", exact: true }),
          ).toBeVisible();
          const copy = tool.getByRole("button", { name: "Copiar", exact: true });
          await copy.focus();
          await copy.press("Enter");
          await expect(tool.getByRole("alert")).toContainText("No se pudo copiar el Markdown");
          await expect(copy).toBeFocused();
          await tool.screenshot({
            path: test.info().outputPath("convertidor-error-cola-mixta.png"),
          });
          await copy.press("Enter");
          const copied = tool.getByRole("button", { name: "Copiado", exact: true });
          await expect(copied).toBeVisible();
          await expect(copied).toBeFocused();
          await expect(tool.getByRole("alert")).toHaveCount(0);
          for (const label of ["Guardar .md", "Guardar todos…"]) {
            await expect(tool.getByRole("button", { name: label, exact: true })).toBeInViewport({
              ratio: 1,
            });
          }
          await expect
            .poll(() => tool.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
            .toBe(true);
          await tool.screenshot({
            path: test.info().outputPath("convertidor-copiado-cola-mixta.png"),
          });
        } finally {
          await app.close().catch(() => undefined);
          await rm(userDataDir, { recursive: true, force: true });
        }
      });
    }
  }
}

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
