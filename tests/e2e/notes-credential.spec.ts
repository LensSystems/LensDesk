import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

test("credenciales privadas: insertar, enmascarar, copiar y revelar", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-credential-e2e-"));
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
    await title.fill("Acceso local");
    await title.press("Enter");
    const editor = tool.locator(".cm-content");
    await editor.click({ button: "right" });
    await expect(tool.getByRole("menuitem", { name: "Contraseña…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await tool.getByRole("menu").press("Escape");
    await tool.getByRole("button", { name: "Hacer privada", exact: true }).click();
    await tool.getByRole("button", { name: "Continuar", exact: true }).click();
    await tool.getByLabel("Contraseña", { exact: true }).fill("Abcd1!");
    await tool.getByLabel("Confirmar contraseña", { exact: true }).fill("Abcd1!");
    await tool.getByLabel("Pregunta de seguridad 1").fill("Ciudad");
    await tool.getByLabel("Pregunta de seguridad 2").fill("Animal");
    await tool.getByLabel("Respuesta 1").fill("Lima");
    await tool.getByLabel("Respuesta 2").fill("Gato");
    await tool.getByRole("button", { name: "Crear contraseña", exact: true }).click();
    await expect(tool.getByRole("button", { name: "Quitar privada", exact: true })).toBeVisible();
    await editor.click({ button: "right" });
    const insert = tool.getByRole("menuitem", { name: "Contraseña…" });
    await expect(insert).not.toHaveAttribute("aria-disabled", "true");
    await insert.click();
    const dialog = tool.getByRole("dialog");
    await dialog.getByLabel("Usuario", { exact: true }).fill("ada@example.test");
    await dialog.getByLabel("Contraseña", { exact: true }).fill("secreto-e2e-unico");
    await dialog.getByLabel("Notas", { exact: true }).fill("Servidor local");
    await dialog.getByRole("button", { name: "Texto simple", exact: true }).click();
    await dialog.getByLabel("Título del campo", { exact: true }).fill("Host");
    await dialog.getByLabel("Texto simple", { exact: true }).fill("localhost");
    await dialog.getByRole("button", { name: "Texto secreto", exact: true }).click();
    await dialog.getByLabel("Título del campo", { exact: true }).nth(1).fill("PIN");
    await dialog.getByLabel("Texto secreto", { exact: true }).fill("932871");
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
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
    await card.getByRole("button", { name: "Copiar", exact: true }).nth(0).click();
    await expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe("ada@example.test");
    await card.getByRole("button", { name: "Copiar", exact: true }).nth(1).click();
    await expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe("secreto-e2e-unico");
    expect(await card.innerHTML()).not.toContain("secreto-e2e-unico");
    await card.getByRole("button", { name: "Mostrar secreto", exact: true }).first().click();
    await expect(card).toContainText("secreto-e2e-unico");
    await card.getByRole("button", { name: "Ocultar secreto", exact: true }).click();
    expect(await card.innerHTML()).not.toContain("secreto-e2e-unico");
    await tool.getByRole("button", { name: "Quitar privada", exact: true }).click();
    await expect(dialog).toContainText("Las contraseñas quedarán sin cifrar");
    await dialog.press("Escape");
    await expect(tool.getByRole("button", { name: "Quitar privada", exact: true })).toBeVisible();
    await tool.getByRole("button", { name: "Quitar privada", exact: true }).click();
    await dialog.getByRole("button", { name: "Quitar privada", exact: true }).click();
    await expect(tool.getByRole("button", { name: "Hacer privada", exact: true })).toBeVisible();
    await expect(tool.locator(".ld-credential")).toHaveCount(0);
    await expect(tool.locator("pre code.language-credential")).toContainText("secreto-e2e-unico");
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
