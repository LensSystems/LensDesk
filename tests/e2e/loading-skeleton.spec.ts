import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

for (const reduce of [false, true]) {
  test(`carga demorada del Convertidor con movimiento ${reduce ? "reducido" : "permitido"}`, async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-carga-"));
    const app = await launchApp({ userDataDir });
    try {
      const shell = await app.firstWindow();
      await enableDeveloperMode(shell);
      await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("md-converter")] });
      await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
      await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
      await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
      const tool = await toolPage(app, "md-converter");
      await tool.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
      await app.evaluate(({ ipcMain }) => {
        // Se envuelve solo la respuesta de conversión de esta instancia de prueba.
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
        ipcMain.removeHandler("lensdesk:tool-invoke");
        ipcMain.handle("lensdesk:tool-invoke", async (event, channel: string, payload: unknown) => {
          const result = await original(event, channel, payload);
          if (channel === "backend.invoke") await new Promise((done) => setTimeout(done, 1200));
          return result;
        });
      });
      await tool.evaluate(() => {
        document.addEventListener("animationstart", (event) => {
          const target = event.target as HTMLElement;
          if (target.classList.contains("ld-carga-entrada"))
            document.body.dataset.duracionCarga = getComputedStyle(target).animationDuration;
        });
      });
      await stubDialog(app, "open", {
        canceled: false,
        filePaths: [resolve("tools/md-converter/tests/fixtures/sample.html")],
      });
      await tool.getByRole("button", { name: "Elegir archivos…" }).click();
      await expect(tool.getByRole("status")).toContainText("Cargando…");
      const blocks = tool.locator(".ld-esqueleto-bloques");
      await expect(blocks).toHaveCSS("animation-duration", reduce ? "0s" : "1.2s");
      await expect(blocks).toHaveCSS("animation-iteration-count", reduce ? "1" : "infinite");
      await expect(blocks).toHaveCount(0);
      const result = tool.getByRole("article");
      await expect(result).toBeVisible();
      await expect(
        result.getByRole("heading", { name: "Documento de prueba", exact: true }),
      ).toBeVisible();
      if (reduce) {
        await expect(result).toHaveCSS("animation-name", "none");
        expect(await tool.locator("body").getAttribute("data-duracion-carga")).toBeNull();
      } else {
        await expect(tool.locator("body")).toHaveAttribute("data-duracion-carga", "0.16s");
      }
    } finally {
      await app.close().catch(() => undefined);
      await rm(userDataDir, { recursive: true, force: true });
    }
  });
}
