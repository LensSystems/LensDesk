import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, lenspkgPath, stubDialog, toolPage } from "./helpers.ts";

for (const setup of [false, true]) {
  test(`privatizar espera los guardados públicos pendientes; configuración inicial=${setup}`, async () => {
    const app = await launchApp();
    try {
      const shell = await app.firstWindow();
      await enableDeveloperMode(shell);
      await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("notes")] });
      await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
      await shell.getByRole("button", { name: "Agregar herramienta…", exact: true }).click();
      await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
      const tool = await toolPage(app, "notes");
      const call = (method: string, params: Record<string, unknown>) =>
        tool.evaluate(
          async ({ method, params }) => {
            const result = await window.lensdesk.backend.invoke(
              crypto.randomUUID(),
              method,
              params,
            );
            if (!result.ok) throw new Error(result.error.code);
            return result.data;
          },
          { method, params },
        );
      if (!setup)
        await call("vaultSetup", {
          password: "Abcd1!",
          questions: ["Ciudad", "Animal"],
          answers: ["Lima", "Gato"],
        });
      await tool.getByRole("button", { name: "Nueva nota", exact: true }).first().click();
      const title = tool.getByRole("textbox", { name: "Título de la nota", exact: true });
      await title.fill("Transición sintética");
      await title.press("Enter");
      const rows = (await call("list", {})) as { id: string; title: string }[];
      const id = rows.find((row) => row.title === "Transición sintética")?.id;
      if (!id) throw new Error("Falta la nota sintética");
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
        const scope = globalThis as typeof globalThis & {
          privacyRace: {
            releaseA?: () => void;
            updates: string[];
            privateCalls: number;
            statuses: number;
          };
        };
        scope.privacyRace = { updates: [], privateCalls: 0, statuses: 0 };
        ipcMain.removeHandler("lensdesk:tool-invoke");
        ipcMain.handle("lensdesk:tool-invoke", async (event, channel, payload) => {
          const operation = payload as { method?: string; params?: { body_md?: string } };
          if (channel === "backend.invoke") {
            if (operation.method === "setPrivate") scope.privacyRace.privateCalls++;
            if (operation.method === "update")
              scope.privacyRace.updates.push(operation.params?.body_md ?? "");
          }
          const result = await original(event, channel, payload);
          if (channel === "backend.invoke" && operation.method === "vaultStatus")
            scope.privacyRace.statuses++;
          if (
            channel === "backend.invoke" &&
            operation.method === "update" &&
            operation.params?.body_md === "PUBLIC_A"
          )
            await new Promise<void>((resolve) => {
              scope.privacyRace.releaseA = resolve;
            });
          return result;
        });
      });
      await tool.clock.install();
      const editor = tool.locator(".cm-content");
      await editor.fill("PUBLIC_A");
      await tool.clock.fastForward(800);
      await expect
        .poll(() =>
          app.evaluate(() =>
            Boolean(
              (
                globalThis as typeof globalThis & {
                  privacyRace: { releaseA?: () => void };
                }
              ).privacyRace.releaseA,
            ),
          ),
        )
        .toBe(true);
      await editor.fill("PUBLIC_B");
      await tool.clock.fastForward(800);
      await tool.getByRole("button", { name: "Hacer privada", exact: true }).click();
      if (setup) {
        await tool.getByRole("button", { name: "Crear contraseña", exact: true }).click();
        const dialog = tool.getByRole("dialog");
        await dialog.getByLabel("Contraseña", { exact: true }).fill("Abcd1!");
        await dialog.getByLabel("Confirmar contraseña", { exact: true }).fill("Abcd1!");
        await dialog.getByLabel("Respuesta 1").fill("Lima");
        await dialog.getByLabel("Respuesta 2").fill("Gato");
        await dialog.getByRole("button", { name: "Guardar y bloquear", exact: true }).click();
      }
      await expect(editor).toHaveAttribute("contenteditable", "false");
      const state = await app.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              privacyRace: { privateCalls: number; updates: string[] };
            }
          ).privacyRace,
      );
      expect(state.privateCalls).toBe(0);
      expect(state.updates).toEqual(["PUBLIC_A"]);
      await app.evaluate(() =>
        (
          globalThis as typeof globalThis & {
            privacyRace: { releaseA?: () => void };
          }
        ).privacyRace.releaseA?.(),
      );
      if (setup) {
        await expect(
          tool.getByRole("heading", { name: "Esta nota es privada", exact: true }),
        ).toBeVisible();
        await tool.getByLabel("Contraseña", { exact: true }).fill("Abcd1!");
        await tool.getByRole("button", { name: "Desbloquear", exact: true }).click();
      } else {
        await expect(
          tool.getByRole("button", { name: "Quitar privada", exact: true }),
        ).toBeVisible();
      }
      await expect(editor).toHaveAttribute("contenteditable", "true");
      await expect(editor).toHaveText("PUBLIC_B");
      await editor.fill("PRIVATE_D");
      await tool.clock.fastForward(800);
      await expect(tool.getByText("Guardado", { exact: true })).toBeVisible();
      await expect
        .poll(async () => ((await call("get", { id })) as { body_md: string }).body_md)
        .toBe("PRIVATE_D");
      await tool.getByRole("button", { name: "Bloquear notas privadas", exact: true }).click();
      await expect(
        tool.getByRole("heading", { name: "Esta nota es privada", exact: true }),
      ).toBeVisible();
      await tool.getByLabel("Contraseña", { exact: true }).fill("Abcd1!");
      await tool.getByRole("button", { name: "Desbloquear", exact: true }).click();
      await expect(editor).toHaveText("PRIVATE_D");
      const persisted = (await call("get", { id })) as { private: boolean; body_md: string };
      expect(persisted).toMatchObject({ private: true, body_md: "PRIVATE_D" });
      await tool.screenshot({
        path: test.info().outputPath("privacidad-sin-escrituras-obsoletas.png"),
      });
    } finally {
      try {
        await app.evaluate(() =>
          (
            globalThis as typeof globalThis & {
              privacyRace?: { releaseA?: () => void };
            }
          ).privacyRace?.releaseA?.(),
        );
      } finally {
        await app.close();
      }
    }
  });
}

for (const privateNote of [false, true]) {
  for (const theme of ["light", "dark"] as const) {
    for (const accent of ["blue", "green"] as const) {
      test(`estado de guardado ${privateNote ? "privado" : "público"}/${theme}/${accent}`, async () => {
        const profile = await mkdtemp(join(tmpdir(), "lensdesk-save-state-"));
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
          await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("notes")] });
          await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
          await shell.getByRole("button", { name: "Agregar herramienta…", exact: true }).click();
          await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
          const tool = await toolPage(app, "notes");
          await tool.getByRole("button", { name: "Nueva nota", exact: true }).first().click();
          const title = tool.getByRole("textbox", { name: "Título de la nota", exact: true });
          await title.fill("Estado sintético de guardado");
          await title.press("Enter");
          if (privateNote) {
            await tool.getByRole("button", { name: "Hacer privada", exact: true }).click();
            await tool.getByRole("button", { name: "Crear contraseña", exact: true }).click();
            const setup = tool.getByRole("dialog");
            await setup.getByLabel("Contraseña", { exact: true }).fill("Abcd1!");
            await setup.getByLabel("Confirmar contraseña", { exact: true }).fill("Abcd1!");
            await setup.getByLabel("Respuesta 1").fill("Lima");
            await setup.getByLabel("Respuesta 2").fill("Gato");
            await setup.getByRole("button", { name: "Guardar y bloquear", exact: true }).click();
            await expect(setup).toBeHidden();
            const locked = tool.getByRole("heading", { name: "Esta nota es privada", exact: true });
            await expect(locked).toBeVisible();
            const unlockForm = tool.locator("form").filter({ has: locked });
            await unlockForm.getByLabel("Contraseña", { exact: true }).fill("Abcd1!");
            const unlock = unlockForm.getByRole("button", { name: "Desbloquear", exact: true });
            await expect(unlock).toBeEnabled();
            await unlock.click();
          }
          const editor = tool.locator('.cm-content[contenteditable="true"]');
          await expect(editor).toBeVisible();
          const window = await app.browserWindow(shell);
          await window.evaluate((browserWindow) => browserWindow.setContentSize(760, 520));
          await expect.poll(() => tool.evaluate(() => innerWidth)).toBe(760);
          await expect(tool.getByText("Sin cambios", { exact: true })).toBeVisible();
          await tool.screenshot({
            animations: "disabled",
            path: test.info().outputPath("guardado-limpio-compacto.png"),
          });
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
            const scope = globalThis as typeof globalThis & {
              saveStateRelease?: () => void;
              saveStateReject: boolean;
              saveStateRequests: number;
            };
            scope.saveStateReject = true;
            scope.saveStateRequests = 0;
            ipcMain.removeHandler("lensdesk:tool-invoke");
            ipcMain.handle(
              "lensdesk:tool-invoke",
              async (event, channel: string, payload: unknown) => {
                if (
                  channel === "backend.invoke" &&
                  (payload as { method?: string }).method === "update"
                ) {
                  scope.saveStateRequests++;
                  await new Promise<void>((resolve) => {
                    scope.saveStateRelease = resolve;
                  });
                  if (scope.saveStateReject)
                    return {
                      ok: false,
                      error: { code: "E_INTERNAL", message: "Synthetic save failure" },
                    };
                }
                return original(event, channel, payload);
              },
            );
          });
          await tool.clock.install();
          await editor.fill("Borrador sintético para la prueba de guardado");
          await expect(tool.getByText("Pendiente", { exact: true })).toBeVisible();
          await tool.screenshot({
            animations: "disabled",
            path: test.info().outputPath("guardado-pendiente-compacto.png"),
          });
          await tool.clock.fastForward(800);
          await expect(tool.getByText("Guardando…", { exact: true })).toBeVisible();
          await expect
            .poll(() =>
              app.evaluate(
                () =>
                  (globalThis as typeof globalThis & { saveStateRequests: number })
                    .saveStateRequests,
              ),
            )
            .toBe(1);
          await tool.screenshot({
            animations: "disabled",
            path: test.info().outputPath("guardado-en-curso-compacto.png"),
          });
          await app.evaluate(() =>
            (
              globalThis as typeof globalThis & { saveStateRelease?: () => void }
            ).saveStateRelease?.(),
          );
          const error = tool.getByRole("alert").filter({ hasText: "No se guardaron los cambios." });
          await expect(error).toBeVisible();
          await expect(editor).toHaveText("Borrador sintético para la prueba de guardado");
          await tool.screenshot({
            animations: "disabled",
            path: test.info().outputPath("guardado-error-compacto.png"),
          });
          for (const name of ["Copiar nota", "Exportar"])
            await expect(tool.getByRole("button", { name, exact: true })).toBeInViewport({
              ratio: 1,
            });
          await window.evaluate((browserWindow) => browserWindow.setContentSize(1280, 800));
          await expect.poll(() => tool.evaluate(() => innerWidth)).toBe(1280);
          await tool.screenshot({
            animations: "disabled",
            path: test.info().outputPath("guardado-error-amplio.png"),
          });
          const retry = tool.getByRole("button", { name: "Reintentar guardado", exact: true });
          await retry.focus();
          await retry.press("Enter");
          await expect
            .poll(() =>
              app.evaluate(
                () =>
                  (globalThis as typeof globalThis & { saveStateRequests: number })
                    .saveStateRequests,
              ),
            )
            .toBe(2);
          await app.evaluate(() => {
            const scope = globalThis as typeof globalThis & {
              saveStateReject: boolean;
              saveStateRelease?: () => void;
            };
            scope.saveStateReject = false;
            scope.saveStateRelease?.();
          });
          await expect(error).toHaveCount(0);
          await expect(tool.getByText("Guardado", { exact: true })).toBeVisible();
          await tool.screenshot({
            animations: "disabled",
            path: test.info().outputPath("guardado-confirmado.png"),
          });
        } finally {
          await app.close().catch(() => undefined);
          await rm(profile, { recursive: true, force: true });
        }
      });
    }
  }
}

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
    const privateRow = list.getByRole("button", { name: "Título público", exact: true });
    await expect(privateRow).toHaveAccessibleDescription("Nota privada. Bloqueada.");
    await expect(privateRow).toHaveAttribute("aria-current", "true");
    await tool.screenshot({ path: test.info().outputPath("privada-bloqueada.png") });
    const unlock = async (password: string) => {
      await tool.getByLabel("Contraseña", { exact: true }).fill(password);
      await tool.getByRole("button", { name: "Desbloquear", exact: true }).click();
    };
    await unlock("errónea");
    await expect(tool.getByRole("alert")).toContainText("4 intentos más antes de esperar 30 s");
    await unlock("Abcd1!");
    await expect(tool.locator(".cm-content")).toHaveText("Contenido privado persistente");
    await expect(tool.getByRole("button", { name: "Quitar privada", exact: true })).toBeVisible();
    await expect(privateRow).toHaveAccessibleDescription("Nota privada. Desbloqueada.");
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
