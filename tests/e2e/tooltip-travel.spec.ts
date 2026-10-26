import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

const toolDir = resolve(import.meta.dirname, "../../tools/md-converter");

test("las etiquetas del Convertidor viajan entre iconos y desaparecen al salir", async () => {
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
    const browserWindowHandle = await app.browserWindow(shell);
    await browserWindowHandle.evaluate((browserWindow) => browserWindow.setContentSize(760, 520));
    await stubDialog(app, "open", {
      canceled: false,
      filePaths: [join(toolDir, "tests/fixtures/sample.csv"), longFile],
    });
    await tool.getByRole("button", { name: "Elegir archivos…" }).click();
    const queue = tool.getByRole("list", { name: "Cola de conversión" });
    await expect(queue.getByRole("img", { name: "Listo" })).toHaveCount(2);

    await tool.emulateMedia({ reducedMotion: "no-preference" });
    await tool.getByRole("button", { name: "Copiar", exact: true }).hover();
    await expect(tool.getByRole("tooltip")).toHaveText("Copiar");
    await tool.getByRole("button", { name: "Guardar .md", exact: true }).hover();
    await expect(tool.getByRole("tooltip")).toHaveCount(1);
    await expect(tool.getByRole("tooltip")).toHaveText("Guardar .md");
    await expect(tool.locator(".ld-tooltip")).toHaveAttribute("data-travel", "end");
    const motion = await tool.locator(".ld-tooltip").evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        state: node.getAttribute("data-state"),
        travel: node.getAttribute("data-travel"),
        animation: style.animationName,
        property: style.transitionProperty,
        duration: style.transitionDuration,
      };
    });
    expect(motion.state).toBe("instant-open");
    expect(motion.travel).toBe("end");
    expect(motion.animation).toBe("none");
    expect(motion.property).toBe("transform");
    expect(motion.duration).toBe("0.14s");
    // Sin animación de cierre: en el fotograma siguiente a la salida ya no queda etiqueta
    // (React aplica el cierre en ese fotograma; antes se desvanecía durante 100 ms).
    await tool.evaluate(() => {
      (window as Window & { tooltipAfterLeave?: Promise<number> }).tooltipAfterLeave = new Promise(
        (resolve) => {
          document.querySelector('button[aria-label="Guardar .md"]')?.addEventListener(
            "pointerleave",
            () => {
              requestAnimationFrame(() =>
                requestAnimationFrame(() =>
                  resolve(document.querySelectorAll('[role="tooltip"]').length),
                ),
              );
            },
            { once: true },
          );
        },
      );
    });
    await tool.mouse.move(740, 500);
    expect(
      await tool.evaluate(
        () => (window as Window & { tooltipAfterLeave?: Promise<number> }).tooltipAfterLeave,
      ),
    ).toBe(0);
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
