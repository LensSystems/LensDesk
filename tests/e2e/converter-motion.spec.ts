import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

type Registro = { nombre: string; duracion: string; tarjeta: boolean; contador: boolean };
for (const reducedMotion of ["no-preference", "reduce"] as const) {
  for (const compact of [false, true]) {
    test(`el Convertidor respeta movimiento ${reducedMotion} y tamaño compacto ${compact}`, async () => {
      const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-movimiento-"));
      const app = await launchApp({ userDataDir });
      try {
        const shell = await app.firstWindow();
        await enableDeveloperMode(shell);
        await stubDialog(app, "open", {
          canceled: false,
          filePaths: [lenspkgPath("md-converter")],
        });
        await shell.getByRole("button", { name: "Herramientas" }).click();
        await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
        await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
        const tool = await toolPage(app, "md-converter");
        await tool.emulateMedia({ reducedMotion });
        if (compact) {
          const window = await app.browserWindow(shell);
          await window.evaluate((browserWindow) => browserWindow.setContentSize(760, 520));
        }
        const archivo = resolve(
          import.meta.dirname,
          "../../tools/md-converter/tests/fixtures/sample.html",
        );
        // Una primera entrada mantiene la cabecera montada al cambiar el contador.
        await stubDialog(app, "open", { canceled: false, filePaths: [archivo] });
        await tool.getByRole("button", { name: "Elegir archivos…" }).click();
        await expect(tool.locator(".queue-result-status")).toHaveCount(1);
        await expect(tool.locator(".estado-saliente")).toHaveCount(0);
        await tool.evaluate(() => {
          const registros: Registro[] = [];
          Object.assign(window, { registros });
          document.addEventListener("animationstart", (event) => {
            const target = event.target as Element;
            if (!target.closest(".queue-card, .queue-heading")) return;
            registros.push({
              nombre: event.animationName,
              duracion: getComputedStyle(target).animationDuration,
              tarjeta: !!target.closest(".queue-card"),
              contador: !!target.closest(".queue-heading"),
            });
          });
        });
        // La capa saliente no debe hacer crecer la lista: se mide el ancho de la tarjeta
        // en cuanto aparece la capa, antes de pintar.
        await tool.evaluate(() => {
          const anchos: number[] = [];
          Object.assign(window, { anchos });
          new MutationObserver(() => {
            const card = document.querySelectorAll(".queue-card")[1];
            if (card && document.querySelector(".progreso-saliente"))
              anchos.push(card.getBoundingClientRect().width);
          }).observe(document.body, { childList: true, subtree: true });
        });
        // Un archivo grande tarda lo bastante para ver «Convirtiendo» antes de «Listo».
        const grande = join(userDataDir, "grande.html");
        await writeFile(
          grande,
          `<html><body>${"<p>Texto de prueba con <b>formato</b> y un <a href='#'>enlace</a>.</p>".repeat(40000)}</body></html>`,
        );
        await stubDialog(app, "open", { canceled: false, filePaths: [grande] });
        await tool.getByRole("button", { name: "Elegir archivos…" }).click();
        await expect(tool.locator(".queue-status")).toHaveCount(1);
        await expect(tool.locator(".queue-result-status")).toHaveCount(2, { timeout: 30000 });
        const registros = () =>
          tool.evaluate(() => (window as Window & { registros?: Registro[] }).registros ?? []);
        if (reducedMotion === "reduce") {
          await tool.waitForTimeout(220);
          expect(await registros()).toEqual([]);
        } else {
          await expect.poll(registros).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                nombre: "entrada-estado",
                duracion: "0.16s",
                tarjeta: true,
              }),
              expect.objectContaining({
                nombre: "ld-text-in",
                duracion: "0.14s",
                contador: true,
              }),
            ]),
          );
          if (compact)
            await expect
              .poll(registros)
              .toEqual(
                expect.arrayContaining([
                  expect.objectContaining({ nombre: "ld-check-draw", duracion: "0.16s" }),
                ]),
              );
        }
        if (reducedMotion === "no-preference") {
          await expect(tool.locator(".progreso-saliente")).toHaveCount(0);
          const final = await tool
            .locator(".queue-card")
            .nth(1)
            .evaluate((card) => card.getBoundingClientRect().width);
          const anchos = await tool.evaluate(
            () => (window as Window & { anchos?: number[] }).anchos ?? [],
          );
          expect(anchos.length).toBeGreaterThan(0);
          for (const ancho of anchos) expect(ancho).toBeCloseTo(final, 0);
        }
        const zona = tool.locator(".ld-file-drop");
        await zona.evaluate((element) => {
          Object.assign(element, { transiciones: [] as string[] });
          element.addEventListener("transitionrun", (event) => {
            if (event.target !== element) return;
            (element as HTMLElement & { transiciones: string[] }).transiciones.push(
              getComputedStyle(element).transitionDuration,
            );
          });
        });
        const data = await tool.evaluateHandle(() => {
          const transfer = new DataTransfer();
          transfer.items.add(new File(["<p>Texto</p>"], "documento.html", { type: "text/html" }));
          return transfer;
        });
        await zona.dispatchEvent("dragenter", { dataTransfer: data });
        await expect(zona).toHaveAttribute("data-dragging", "true");
        await expect(zona).toHaveCSS(
          "transition-duration",
          reducedMotion === "reduce" ? "0s" : "0.15s, 0.15s, 0.15s",
        );
        await expect(zona).toHaveCSS(
          "transform",
          reducedMotion === "reduce" ? "none" : "matrix(1.01, 0, 0, 1.01, 0, 0)",
        );
        const transiciones = await zona.evaluate(
          (element) => (element as HTMLElement & { transiciones: string[] }).transiciones,
        );
        if (reducedMotion === "reduce") expect(transiciones).toEqual([]);
        else expect(transiciones).toContain("0.15s, 0.15s, 0.15s");
        await zona.dispatchEvent("dragleave", { dataTransfer: data });
        await expect(zona).toHaveAttribute("data-dragging", "false");
        await data.dispose();
      } finally {
        await app.close().catch(() => undefined);
        await rm(userDataDir, { recursive: true, force: true });
      }
    });
  }
}
