import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

const outline = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement as HTMLElement;
    const style = getComputedStyle(active);
    return `${active.getAttribute("aria-label") ?? active.tagName} ${style.outlineStyle} ${style.outlineWidth}`;
  });

test("el contorno de foco sale con teclado y no con un clic", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-foco-"));
  const app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    for (const id of ["md-converter", "notes"] as const) {
      await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath(id)] });
      await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
      await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
      await expect(shell.getByRole("button", { name: /^Abrir / }).first()).toBeVisible();
    }
    await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
    const converter = await toolPage(app, "md-converter");

    // El primer clic en la vista de la herramienta se marcaba como foco de teclado.
    await converter.getByRole("tab", { name: "Markdown crudo" }).click();
    await expect.poll(() => outline(converter)).toMatch(/^Markdown crudo none /);
    await converter.keyboard.press("ArrowLeft");
    await expect.poll(() => outline(converter)).toBe("Vista renderizada solid 2px");

    // En la ventana principal, un clic en una pestaña no revela la ✕ por foco.
    const tab = shell.getByRole("tab", { name: "Convertidor" });
    await tab.click();
    await shell.mouse.move(5, 300);
    const close = shell.getByRole("button", { name: "Cerrar Convertidor" });
    await expect(close).toHaveCSS("opacity", "0");
    await shell.keyboard.press("Tab");
    await shell.keyboard.press("Shift+Tab");
    await expect.poll(() => outline(shell)).toMatch(/solid 2px$/);

    // Los campos de texto conservan el contorno también con clic.
    await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const notes = await toolPage(app, "notes");
    await notes.getByRole("textbox", { name: "Buscar notas" }).click();
    await expect.poll(() => outline(notes)).toMatch(/solid 2px$/);
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
