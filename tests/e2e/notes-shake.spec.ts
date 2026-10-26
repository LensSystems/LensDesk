import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`contraseña fallida: movimiento con preferencia ${reducedMotion}`, async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-motion-e2e-"));
    const app = await launchApp({ userDataDir });
    try {
      const shell = await app.firstWindow();
      await enableDeveloperMode(shell);
      await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("notes")] });
      await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
      await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
      await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
      const tool = await toolPage(app, "notes");
      await tool.getByRole("button", { name: "Nueva nota" }).first().click();
      const title = tool.getByRole("textbox", { name: "Título de la nota" });
      await title.fill("Título público");
      await title.press("Enter");
      await tool.locator(".cm-content").fill("Contenido privado persistente");
      const lock = tool.getByRole("button", { name: "Hacer privada", exact: true });
      await lock.click();
      await expect(tool.getByRole("dialog")).toContainText("El título sigue visible");
      await tool.getByRole("dialog").press("Escape");
      await expect(lock).toBeFocused();
      await lock.click();
      await tool.getByRole("button", { name: "Crear contraseña", exact: true }).click();
      await expect(tool.getByLabel("Contraseña", { exact: true })).toBeFocused();
      await tool.getByRole("dialog").press("Escape");
      await expect(lock).toBeFocused();
      await lock.click();
      await tool.getByRole("button", { name: "Crear contraseña", exact: true }).click();
      const setup = tool.getByRole("dialog");
      await setup.getByLabel("Contraseña", { exact: true }).fill("Abcd1!");
      await setup.getByLabel("Confirmar contraseña", { exact: true }).fill("Abcd1!");
      await setup.getByLabel("Respuesta 1").fill("Lima");
      await setup.getByLabel("Respuesta 2").fill("Gato");
      await setup.getByRole("button", { name: "Guardar y bloquear", exact: true }).click();

      await expect(tool.getByRole("heading", { name: "Esta nota es privada" })).toBeVisible();
      await tool.emulateMedia({ reducedMotion });
      await tool.evaluate(() => {
        const events: { name: string; duration: string }[] = [];
        Object.assign(window, { vaultEvents: events });
        document.addEventListener("animationstart", (event) => {
          if (!(event.target instanceof Element)) return;
          if (!event.target.matches(".secret-field-control, .vault-error")) return;
          events.push({
            name: event.animationName,
            duration: getComputedStyle(event.target).animationDuration,
          });
        });
      });
      for (const count of [1, 2]) {
        const field = tool.getByLabel("Contraseña", { exact: true });
        await field.fill("incorrecta");
        await field.press("Enter");
        await expect(tool.getByRole("alert")).toContainText(`${5 - count} intentos`);
        await expect(field).toBeFocused();
        if (reducedMotion === "no-preference") {
          await expect
            .poll(() =>
              tool.evaluate(() =>
                (
                  window as unknown as { vaultEvents: { name: string; duration: string }[] }
                ).vaultEvents
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name)),
              ),
            )
            .toEqual(
              Array.from({ length: count }, () => [
                { name: "ld-shake", duration: "0.2s" },
                { name: "error-boveda", duration: "0.15s" },
              ])
                .flat()
                .sort((a, b) => a.name.localeCompare(b.name)),
            );
        } else {
          await tool.waitForTimeout(250);
          expect(
            await tool.evaluate(
              () => (window as unknown as { vaultEvents: unknown[] }).vaultEvents,
            ),
          ).toEqual([]);
        }
      }
    } finally {
      await app.close().catch(() => undefined);
      await rm(userDataDir, { recursive: true, force: true });
    }
  });
}
