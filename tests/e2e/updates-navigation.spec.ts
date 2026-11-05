import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, installTool, launchApp, lenspkgPath, shellPage } from "./helpers.ts";
import {
  mockUpdateSources,
  restoreUpdateSources,
  updateRequests,
  updateScenario,
} from "./update-fixture.ts";

for (const theme of ["light", "dark"] as const) {
  for (const accent of ["blue", "green"] as const) {
    for (const width of [1280, 760]) {
      test(`resultados independientes ${theme}/${accent}/${width}`, async () => {
        const app = await launchApp();
        try {
          const page = await shellPage(app);
          await mockUpdateSources(app);
          const rendererRequests: string[] = [];
          page.on("request", (request) => {
            if (/^https?:/.test(request.url())) rendererRequests.push(request.url());
          });
          await enableDeveloperMode(page);
          await installTool(app, page, lenspkgPath("notes"), "Notas");
          await installTool(app, page, lenspkgPath("md-converter"), "Convertidor");
          const english = accent === "green";
          await page.evaluate(
            async ({ theme, accent, english }) => {
              for (const [key, value] of [
                ["theme", theme],
                ["accent", accent],
                ["locale", english ? "en" : "es"],
              ] as const)
                await window.lensdeskHost.invoke("settings.set", { key, value });
            },
            { theme, accent, english },
          );
          const browserWindow = await app.browserWindow(page);
          await browserWindow.evaluate(
            (window, width) => window.setSize(width, width === 760 ? 520 : 800),
            width,
          );
          await page.emulateMedia({ reducedMotion: width === 760 ? "reduce" : "no-preference" });
          const currentVersion = await app.evaluate(({ app }) => app.getVersion());
          const labels = {
            settings: english ? "Settings" : "Ajustes",
            tools: english ? "Tools" : "Herramientas",
            check: english ? "Check now" : "Buscar ahora",
            notes: english ? "Notes" : "Notas",
            count: english
              ? "Updates are available for 2 tools"
              : "Hay actualizaciones disponibles para 2 herramientas",
            download: english ? "Download" : "Descargar",
            install: english ? "Install file…" : "Instalar archivo…",
            go: english ? "Go to Settings" : "Ir a Ajustes",
          };
          const minimum =
            theme === "dark" && accent === "green" && width === 760
              ? `0.9.0+${"longbuild".repeat(27)}`
              : "0.9.0";
          await updateScenario(app, "tools", minimum);
          await page.getByRole("button", { name: labels.settings, exact: true }).click();
          expect(await updateRequests(app)).toEqual([]);
          const check = page.getByRole("button", { name: labels.check, exact: true });
          await check.click();
          const link = page.getByRole("link", { name: labels.count, exact: true });
          await expect(link).toBeVisible();
          const row = page.locator("[data-update-row]");
          await expect(row.locator(".ld-swap-old")).toHaveCount(0);
          await expect(row.getByRole("status")).toHaveCount(1);
          await expect(row).toContainText(
            english
              ? `LensDesk ${currentVersion} is up to date.`
              : `LensDesk ${currentVersion} está actualizado.`,
          );
          // Reach the real navigation link with Tab; Enter must switch the host page.
          for (let attempt = 0; attempt < 30; attempt++) {
            if (await link.evaluate((element) => element === document.activeElement)) break;
            await page.keyboard.press("Tab");
          }
          await expect(link).toBeFocused();
          const directory = test.info().outputPath("updates", `${theme}-${accent}-${width}`);
          await mkdir(directory, { recursive: true });
          await row.scrollIntoViewIfNeeded();
          await page.screenshot({ path: join(directory, "settings.png") });
          await link.press("Enter");
          await expect(
            page.getByRole("heading", { level: 1, name: labels.tools, exact: true }),
          ).toBeFocused();
          const notes = page
            .getByRole("heading", { level: 2, name: labels.notes, exact: true })
            .locator("xpath=ancestor::article");
          await expect(
            notes.getByRole("button", { name: labels.download, exact: true }),
          ).toHaveCount(1);
          await expect(
            notes.getByRole("button", { name: labels.install, exact: true }),
          ).toHaveCount(1);
          await expect(notes).toContainText(minimum);
          await expect
            .poll(() =>
              page
                .locator(".ld-tool-update")
                .evaluateAll((elements) =>
                  elements.every((element) =>
                    element
                      .getAnimations()
                      .every((animation) => animation.playState === "finished"),
                  ),
                ),
            )
            .toBe(true);
          await expect
            .poll(() =>
              page
                .locator("main")
                .evaluate((element) => element.scrollWidth <= element.clientWidth),
            )
            .toBe(true);
          await expect
            .poll(() => notes.evaluate((element) => element.scrollWidth <= element.clientWidth))
            .toBe(true);
          await page.screenshot({ path: join(directory, "tools.png") });
          if (width === 760) {
            await notes
              .getByRole("link", { name: labels.go, exact: true })
              .scrollIntoViewIfNeeded();
            await page.screenshot({ path: join(directory, "tools-warning.png") });
          }
          expect((await updateRequests(app)).length).toBe(2);
          await page.getByRole("button", { name: labels.settings, exact: true }).click();
          await expect(page.getByRole("link", { name: labels.count, exact: true })).toBeVisible();
          expect((await updateRequests(app)).length).toBe(2);

          if (theme === "light" && accent === "blue" && width === 760) {
            for (const scenario of [
              "both",
              "app-error",
              "tools-error",
              "none",
              "app",
              "api",
              "error",
            ] as const) {
              await updateScenario(app, scenario);
              await check.click();
              await expect(check).toBeEnabled();
              await expect(row.locator(".ld-swap-old")).toHaveCount(0);
              const status = row.getByRole("status");
              if (scenario === "both" || scenario === "app")
                await expect(
                  status.getByRole("link", {
                    name: "Versión 0.8.0 de LensDesk disponible",
                    exact: true,
                  }),
                ).toBeVisible();
              if (scenario === "app-error" || scenario === "error")
                await expect(status).toContainText(
                  "No se pudo comprobar LensDesk. Vuelve a buscar.",
                );
              if (scenario === "tools-error" || scenario === "error")
                await expect(status).toContainText(
                  "No se pudieron comprobar las herramientas. Vuelve a buscar.",
                );
              if (scenario === "app-error" || scenario === "tools-error")
                await expect(status).toContainText("Resultados de una búsqueda anterior.");
              if (scenario === "none") {
                await expect(status).toContainText("Todas las herramientas están actualizadas.");
                await expect(status.getByRole("link")).toHaveCount(0);
                await expect(page.locator("header [data-notice-capsule]")).toHaveCount(0);
              }
              if (scenario === "api") {
                await expect(status).toContainText("no es compatible con este LensDesk");
                await expect(status).not.toContainText("requiere LensDesk 0.1.0");
              }
              await page.screenshot({ path: join(directory, `${scenario}.png`) });
            }
            // Warning navigation uses the existing update-row focus request, without another GET.
            await page.getByRole("button", { name: labels.tools, exact: true }).click();
            await page.getByRole("button", { name: "Acciones de Notas", exact: true }).click();
            await page.getByRole("menuitem", { name: "Ver detalles", exact: true }).click();
            const warning = page
              .getByRole("dialog")
              .getByRole("link", { name: labels.go, exact: true });
            await warning.focus();
            await warning.press("Enter");
            await expect(check).toBeFocused();
          }
          expect(rendererRequests).toEqual([]);
          const requests = await updateRequests(app);
          expect(
            requests.every(
              (url) =>
                url === "https://api.github.com/repos/LensSystems/LensDesk/releases/latest" ||
                url === "https://lenssystems.github.io/LensDesk/tools-catalog-v1.json",
            ),
          ).toBe(true);
        } finally {
          await restoreUpdateSources(app).catch(() => undefined);
          await app.close();
        }
      });
    }
  }
}
