import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { launchApp, shellPage } from "./helpers.ts";

for (const theme of ["light", "dark"] as const) {
  for (const accent of ["blue", "green"] as const) {
    test(`Ajustes conserva el valor rechazado y permite reintentar con ${theme}/${accent}`, async () => {
      const profile = await mkdtemp(join(tmpdir(), "lensdesk-settings-feedback-"));
      const app = await launchApp({ userDataDir: profile });
      try {
        const shell = await shellPage(app);
        const window = await app.browserWindow(shell);
        await window.evaluate((browserWindow) => browserWindow.setContentSize(760, 520));
        await shell.getByRole("button", { name: "Ajustes", exact: true }).click();
        await shell
          .getByRole("radiogroup", { name: "Tema", exact: true })
          .getByRole("radio", { name: theme === "light" ? "Claro" : "Oscuro", exact: true })
          .click();
        await shell
          .getByRole("radiogroup", { name: "Color de acento", exact: true })
          .getByRole("radio", { name: accent === "blue" ? "Azul" : "Verde", exact: true })
          .click();
        await expect(shell.locator("html")).toHaveAttribute("data-theme", theme);
        await app.evaluate(({ ipcMain }) => {
          const handlers = (
            ipcMain as unknown as {
              _invokeHandlers: Map<
                string,
                (event: Electron.IpcMainInvokeEvent, channel: string, payload: unknown) => unknown
              >;
            }
          )._invokeHandlers;
          const original = handlers.get("lensdesk:invoke");
          if (!original) throw new Error("Falta el receptor del host");
          const scope = globalThis as typeof globalThis & {
            settingsFeedbackAttempts: number;
            releaseSettingsFeedback?: () => void;
          };
          scope.settingsFeedbackAttempts = 0;
          ipcMain.removeHandler("lensdesk:invoke");
          ipcMain.handle("lensdesk:invoke", async (event, channel: string, payload: unknown) => {
            if (
              channel === "settings.set" &&
              (payload as { key?: string }).key === "developerMode"
            ) {
              scope.settingsFeedbackAttempts++;
              if (scope.settingsFeedbackAttempts === 1) {
                await new Promise<void>((resolve) => {
                  scope.releaseSettingsFeedback = resolve;
                });
                return { ok: false, error: { code: "E_INTERNAL", message: "private test detail" } };
              }
            }
            return original(event, channel, payload);
          });
        });
        const developer = shell.getByRole("switch", { name: "Modo desarrollador", exact: true });
        await developer.scrollIntoViewIfNeeded();
        await developer.focus();
        await developer.press("Space");
        await expect(
          shell.getByRole("status").filter({ hasText: "Guardando Modo desarrollador" }),
        ).toBeVisible();
        await expect(developer).not.toBeChecked();
        await expect(developer).toBeFocused();
        await expect(developer).toHaveAttribute("aria-disabled", "true");
        await expect(developer).toHaveAttribute("aria-busy", "true");
        await developer.press("Space");
        expect(
          await app.evaluate(
            () =>
              (globalThis as typeof globalThis & { settingsFeedbackAttempts: number })
                .settingsFeedbackAttempts,
          ),
        ).toBe(1);
        await shell.screenshot({ path: test.info().outputPath("ajustes-pendiente.png") });
        await app.evaluate(() =>
          (
            globalThis as typeof globalThis & { releaseSettingsFeedback?: () => void }
          ).releaseSettingsFeedback?.(),
        );
        const alert = shell
          .getByRole("alert")
          .filter({ hasText: "No se pudo guardar Modo desarrollador" });
        await expect(alert).toBeVisible();
        await expect(alert).not.toContainText("private test detail");
        await expect(developer).not.toBeChecked();
        await expect(developer).toBeFocused();
        await shell.screenshot({ path: test.info().outputPath("ajustes-error.png") });
        await alert.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(developer).toBeChecked();
        await expect(developer).toBeFocused();
        await expect(alert).toHaveCount(0);
        await expect(shell.getByText("Guardando Modo desarrollador…", { exact: true })).toHaveCount(
          0,
        );
        await shell.getByRole("combobox", { name: "Idioma", exact: true }).click();
        await shell.getByRole("option", { name: "Inglés", exact: true }).click();
        await expect(shell.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
        await expect(
          shell.getByRole("switch", { name: "Developer mode", exact: true }),
        ).toBeChecked();
        await expect(shell.locator("html")).toHaveAttribute("data-theme", theme);
      } finally {
        await app.close().catch(() => undefined);
        await rm(profile, { recursive: true, force: true });
      }
    });
  }
}
