import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

test("notas privadas: configurar, bloquear, desbloquear y recuperar el contenido", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-private-e2e-"));
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
    // Al guardar, la nota queda privada y bloqueada.
    await expect(tool.getByRole("heading", { name: "Esta nota es privada" })).toBeVisible();
    await expect(tool.locator(".cm-content")).toHaveCount(0);
    const list = tool.getByRole("navigation", { name: "Lista de notas" });
    await expect(list).toContainText("Bloqueada");
    await expect(list).not.toContainText("Contenido privado persistente");
    const unlock = async (password: string) => {
      await tool.getByLabel("Contraseña", { exact: true }).fill(password);
      await tool.getByRole("button", { name: "Desbloquear", exact: true }).click();
    };
    await unlock("errónea");
    await expect(tool.getByRole("alert")).toContainText("4 intentos más antes de esperar 30 s");
    await unlock("Abcd1!");
    await expect(tool.locator(".cm-content")).toHaveText("Contenido privado persistente");
    await expect(tool.getByRole("button", { name: "Quitar privada", exact: true })).toBeVisible();
    const expectLocked = async () => {
      await expect(tool.getByRole("heading", { name: "Esta nota es privada" })).toBeVisible();
      await expect(tool.getByRole("button", { name: "Copiar nota", exact: true })).toHaveCount(0);
      await expect(tool.getByRole("button", { name: "Exportar", exact: true })).toHaveCount(0);
      await expect(tool.locator(".cm-content")).toHaveCount(0);
    };
    const hideAndReturn = async () => {
      await shell.getByRole("button", { name: "Ajustes", exact: true }).click();
      await shell.getByRole("tab", { name: /Notas/ }).click();
      await expectLocked();
    };
    await tool.getByRole("button", { name: "Bloquear notas privadas", exact: true }).click();
    await expectLocked();
    await unlock("Abcd1!");
    await expect(tool.locator(".cm-content")).toHaveText("Contenido privado persistente");
    await hideAndReturn();
    const forgot = tool.getByRole("button", { name: "¿Olvidaste la contraseña?", exact: true });
    await forgot.click();
    const pet = tool.getByLabel("¿Cómo se llamaba tu primera mascota?", { exact: true });
    await expect(pet).toBeFocused();
    await tool.getByRole("dialog").press("Escape");
    await expect(tool.getByRole("heading", { name: "Título público" })).toBeFocused();
    await forgot.click();
    await pet.fill("lima");
    await tool.getByLabel("¿En qué ciudad naciste?", { exact: true }).fill("GATO");
    const dialog = tool.getByRole("dialog");
    await dialog.getByLabel("Contraseña", { exact: true }).fill("Nuevo2!");
    await dialog.getByLabel("Confirmar contraseña", { exact: true }).fill("Nuevo2!");
    await dialog.getByRole("button", { name: "Restablecer contraseña", exact: true }).click();
    await expect(tool.locator(".cm-content")).toHaveText("Contenido privado persistente");
    await hideAndReturn();
    await unlock("Nuevo2!");
    await expect(tool.locator(".cm-content")).toHaveText("Contenido privado persistente");
    await tool.getByRole("button", { name: "Quitar privada", exact: true }).click();
    await expect(tool.getByRole("button", { name: "Hacer privada", exact: true })).toBeVisible();
    await expect(tool.locator(".cm-content")).toHaveText("Contenido privado persistente");
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
