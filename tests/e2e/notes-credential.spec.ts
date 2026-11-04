import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

for (const theme of ["light", "dark"] as const) {
  for (const accent of ["blue", "green"] as const) {
    test(`credenciales privadas: insertar, enmascarar, copiar y revelar (${theme}/${accent})`, async () => {
      const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-credential-e2e-"));
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
        await expect(shell.locator("html")).toHaveAttribute("data-theme", theme);
        await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("notes")] });
        await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
        await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
        await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
        const tool = await toolPage(app, "notes");
        await tool.getByRole("button", { name: "Nueva nota" }).first().click();
        const title = tool.getByRole("textbox", { name: "Título de la nota" });
        await title.fill("Acceso local");
        await title.press("Enter");
        const editor = tool.locator(".cm-content");
        await editor.click({ button: "right" });
        await tool.getByRole("menuitem", { name: "Insertar", exact: true }).click();
        await expect(tool.getByRole("menuitem", { name: "Contraseña…" })).toHaveAttribute(
          "aria-disabled",
          "true",
        );
        await tool.getByRole("menu", { name: "Menú de edición" }).press("Escape");
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
        await expect(
          tool.getByRole("button", { name: "Quitar privada", exact: true }),
        ).toBeVisible();
        await editor.click({ button: "right" });
        await tool.getByRole("menuitem", { name: "Insertar", exact: true }).click();
        const insert = tool.getByRole("menuitem", { name: "Contraseña…" });
        await expect(insert).not.toHaveAttribute("aria-disabled", "true");
        await insert.click();
        const dialog = tool.getByRole("dialog");
        await dialog.getByLabel("Usuario", { exact: true }).fill("ada@example.test");
        await dialog.getByLabel("Contraseña", { exact: true }).fill("secreto-e2e-unico");
        await dialog.getByLabel("Notas", { exact: true }).fill("Servidor local");
        await dialog.getByRole("button", { name: "Añadir campo", exact: true }).click();
        await tool.getByRole("menuitem", { name: "Texto simple", exact: true }).click();
        await expect(dialog.getByLabel("Nombre del campo", { exact: true })).toBeFocused();
        await tool.keyboard.type("Host");
        await dialog.getByLabel("Host", { exact: true }).fill("localhost");
        await dialog.getByRole("button", { name: "Añadir campo", exact: true }).click();
        await tool.getByRole("menuitem", { name: "Texto secreto", exact: true }).click();
        await expect(dialog.getByLabel("Nombre del campo", { exact: true }).nth(1)).toBeFocused();
        await tool.keyboard.type("PIN");
        await dialog.getByLabel("PIN", { exact: true }).fill("932871");
        await expect(dialog.getByText("Texto simple", { exact: true })).toBeVisible();
        await expect(dialog.getByText("Texto secreto", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Insertar", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(editor).toContainText("```credential");
        await expect(editor).toContainText("•••••••");
        await expect(editor).toContainText("ada@example.test");
        await expect(editor).not.toContainText("secreto-e2e-unico");
        await expect(editor).not.toContainText("932871");
        await tool.getByRole("radio", { name: "Ver", exact: true }).click();
        const card = tool.locator(".ld-credential");
        await expect(card).toBeVisible();
        // Incluye atributos y controles: ningún secreto debe llegar al HTML oculto.
        expect(await card.innerHTML()).not.toContain("secreto-e2e-unico");
        expect(await card.innerHTML()).not.toContain("932871");
        await expect(card.getByRole("button", { name: "Copiar código" })).toHaveCount(0);
        const passwordRow = card
          .locator("div")
          .filter({ has: tool.getByText("Contraseña", { exact: true }) });
        await expect(card.getByRole("button", { name: "Copiar Notas" })).toHaveCount(0);
        await card.getByRole("button", { name: "Copiar Usuario", exact: true }).click();
        await expect
          .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
          .toBe("ada@example.test");
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
          let rejectNextCopy = true;
          ipcMain.removeHandler("lensdesk:tool-invoke");
          ipcMain.handle(
            "lensdesk:tool-invoke",
            async (event, channel: string, payload: unknown) => {
              if (channel === "ui.copyText" && rejectNextCopy) {
                rejectNextCopy = false;
                return { ok: false, error: { code: "E_INTERNAL", message: "Copy rejected" } };
              }
              return original(event, channel, payload);
            },
          );
        });
        const window = await app.browserWindow(shell);
        await window.evaluate((browserWindow) => browserWindow.setContentSize(760, 520));
        const copyPassword = passwordRow.locator('button[data-action="copy"]');
        await copyPassword.focus();
        await copyPassword.press("Enter");
        const copyError = tool.getByRole("alert").filter({ hasText: "No se pudo copiar" });
        await expect(copyError).toBeVisible();
        await expect(copyPassword).toBeFocused();
        await expect(copyPassword).toHaveAccessibleName("Copiar Contraseña");
        expect(await card.innerHTML()).not.toContain("secreto-e2e-unico");
        await tool.screenshot({
          path: test.info().outputPath("credencial-error-copia-compacta.png"),
        });
        await copyPassword.press("Enter");
        await expect(copyError).toHaveCount(0);
        await expect(copyPassword).toBeFocused();
        await expect
          .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
          .toBe("secreto-e2e-unico");
        expect(await card.innerHTML()).not.toContain("secreto-e2e-unico");
        await window.evaluate((browserWindow) => browserWindow.setContentSize(1280, 800));
        await card.getByRole("button", { name: "Mostrar Contraseña", exact: true }).click();
        await expect(card).toContainText("secreto-e2e-unico");
        await card.getByRole("button", { name: "Ocultar Contraseña", exact: true }).click();
        expect(await card.innerHTML()).not.toContain("secreto-e2e-unico");
        await tool.getByRole("button", { name: "Quitar privada", exact: true }).click();
        await expect(dialog).toContainText("Las contraseñas quedarán sin cifrar");
        await dialog.press("Escape");
        await expect(
          tool.getByRole("button", { name: "Quitar privada", exact: true }),
        ).toBeVisible();
        await tool.getByRole("button", { name: "Quitar privada", exact: true }).click();
        await dialog.getByRole("button", { name: "Quitar privada", exact: true }).click();
        await expect(
          tool.getByRole("button", { name: "Hacer privada", exact: true }),
        ).toBeVisible();
        await expect(tool.locator(".ld-credential")).toHaveCount(0);
        await expect(tool.locator("pre code.language-credential")).toContainText(
          "secreto-e2e-unico",
        );
      } finally {
        await app.close().catch(() => undefined);
        await rm(userDataDir, { recursive: true, force: true });
      }
    });
  }
}
