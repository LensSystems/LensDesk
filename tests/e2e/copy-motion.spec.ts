import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

// El botón de React se monta de nuevo al cambiar de estado: se localiza por su nombre y las
// transiciones de ancho se recogen en el documento.
async function checkCopy(page: Page, scope: Locator, idle: string, reduce: boolean) {
  await page.evaluate(() => {
    const scope = window as Window & { copyDurations?: number[]; copyListener?: boolean };
    scope.copyDurations = [];
    if (scope.copyListener) return;
    scope.copyListener = true;
    document.addEventListener("transitionrun", (event) => {
      const target = event.target as HTMLElement;
      if ((event as TransitionEvent).propertyName === "width" && target.tagName === "BUTTON")
        scope.copyDurations?.push(Number.parseFloat(getComputedStyle(target).transitionDuration));
    });
  });
  const button = scope.getByRole("button", { name: idle, exact: true });
  const initial = await button.evaluate((element) => element.getBoundingClientRect().width);
  await button.click();
  const copied = scope.getByRole("button", { name: "Copiado", exact: true });
  await expect(copied).toBeVisible();
  await expect
    .poll(() => copied.evaluate((element) => element.getBoundingClientRect().width))
    .toBeGreaterThan(initial);
  await expect(button).toBeVisible({ timeout: 3500 });
  await expect.poll(() => button.evaluate((element) => element.style.width)).toBe("");
  expect(await button.evaluate((element) => element.getBoundingClientRect().width)).toBeCloseTo(
    initial,
    1,
  );
  const durations = await page.evaluate(
    () => (window as Window & { copyDurations?: number[] }).copyDurations,
  );
  expect(durations).toEqual(reduce ? [] : [0.15, 0.15]);
}

for (const reduce of [false, true]) {
  test(`copiar en Notas y Convertidor con movimiento ${reduce ? "reducido" : "permitido"}`, async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-copy-motion-"));
    const app = await launchApp({ userDataDir });
    try {
      const shell = await app.firstWindow();
      await enableDeveloperMode(shell);
      await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("notes")] });
      await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
      await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
      await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
      const tool = await toolPage(app, "notes");
      await tool.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
      await tool.getByRole("button", { name: "Nueva nota" }).first().click();
      const title = tool.getByRole("textbox", { name: "Título de la nota" });
      await title.fill("Copia local");
      await title.press("Enter");
      const editor = tool.locator(".cm-content");
      await editor.fill("```ts\nconst local = true;\n```");
      await checkCopy(tool, tool.locator("body"), "Copiar nota", reduce);
      await tool.getByRole("radio", { name: "Ver", exact: true }).click();
      await checkCopy(tool, tool.locator("body"), "Copiar código", reduce);
      await tool.getByRole("radio", { name: "Editar", exact: true }).click();
      await tool.getByRole("button", { name: "Hacer privada", exact: true }).click();
      await tool.getByRole("button", { name: "Crear contraseña", exact: true }).click();
      const setup = tool.getByRole("dialog");
      await setup.getByLabel("Contraseña", { exact: true }).fill("Abcd1!");
      await setup.getByLabel("Confirmar contraseña", { exact: true }).fill("Abcd1!");
      await setup.getByLabel("Respuesta 1").fill("Lima");
      await setup.getByLabel("Respuesta 2").fill("Gato");
      await setup.getByRole("button", { name: "Guardar y bloquear", exact: true }).click();
      await expect(tool.getByRole("heading", { name: "Esta nota es privada" })).toBeVisible();
      await tool.getByLabel("Contraseña", { exact: true }).fill("Abcd1!");
      await tool.getByRole("button", { name: "Desbloquear", exact: true }).click();
      await expect(tool.getByRole("button", { name: "Quitar privada", exact: true })).toBeVisible();

      await editor.click({ button: "right" });
      await tool.getByRole("menuitem", { name: "Insertar", exact: true }).click();
      const insert = tool.getByRole("menuitem", { name: "Contraseña…" });
      await expect(insert).not.toHaveAttribute("aria-disabled", "true");
      // Con teclado: sin animación, el recorrido del puntero hasta el submenú puede cerrarlo.
      await insert.press("Enter");
      const dialog = tool.getByRole("dialog");
      await dialog.getByLabel("Usuario", { exact: true }).fill("ada");
      await dialog.getByLabel("Contraseña", { exact: true }).fill("clave-local");
      await dialog.getByRole("button", { name: "Insertar", exact: true }).click();
      await tool.getByRole("radio", { name: "Ver", exact: true }).click();
      await checkCopy(tool, tool.locator("body"), "Copiar Usuario", reduce);
      await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("md-converter")] });
      await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
      await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
      await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
      const converter = await toolPage(app, "md-converter");
      await converter.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
      await stubDialog(app, "open", {
        canceled: false,
        filePaths: [resolve("tools/md-converter/tests/fixtures/sample.html")],
      });
      await converter.getByRole("button", { name: "Elegir archivos…" }).click();
      await expect(converter.getByRole("list", { name: "Cola de conversión" })).toContainText(
        "Listo",
      );
      await checkCopy(converter, converter.locator(".preview-toolbar"), "Copiar", reduce);
    } finally {
      await app.close().catch(() => undefined);
      await rm(userDataDir, { recursive: true, force: true });
    }
  });
}
