import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { launchApp, shellPage } from "./helpers.ts";
import { prepareRecentUpdateProfile } from "./profile.ts";

type UpdateFixtureScope = typeof globalThis & {
  updateCheckFixture?: { calls: number; release(): void; restore(): void };
};

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`el texto de actualizaciones y los enlaces respetan movimiento ${reducedMotion}`, async () => {
    const profile = await mkdtemp(join(tmpdir(), "lensdesk-update-motion-"));
    try {
      await prepareRecentUpdateProfile(profile);
      const app = await launchApp({ userDataDir: profile });
      try {
        const page = await shellPage(app);
        await expect(
          page.getByRole("heading", { name: "Herramientas", exact: true }),
        ).toBeVisible();
        // Respuesta local de la consulta de versiones: ninguna petición sale de la máquina.
        await app.evaluate(() => {
          const scope = globalThis as UpdateFixtureScope;
          const original = globalThis.fetch;
          let release = () => {};
          const pending = new Promise<void>((resolve) => {
            release = resolve;
          });
          const fixture = {
            calls: 0,
            release,
            restore: () => {
              globalThis.fetch = original;
              delete scope.updateCheckFixture;
            },
          };
          scope.updateCheckFixture = fixture;
          globalThis.fetch = async (input) => {
            fixture.calls++;
            await pending;
            if (String(input) === "https://lenssystems.github.io/LensDesk/tools-catalog-v1.json")
              return Response.json({
                schemaVersion: 1,
                repository: "LensSystems/LensDesk",
                generatedAt: "2026-11-04T12:00:00.000Z",
                releases: [],
              });
            return new Response(
              JSON.stringify({
                tag_name: "v0.0.1",
                html_url: "https://github.com/LensSystems/LensDesk/releases/tag/v0.0.1",
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          };
        });
        const calls = () =>
          app.evaluate(() => (globalThis as UpdateFixtureScope).updateCheckFixture?.calls);
        await page.emulateMedia({ reducedMotion });
        await page.getByRole("button", { name: "Ajustes", exact: true }).click();
        const row = page.locator("[data-update-row]");
        await row.evaluate((element) => {
          const scope = element as HTMLElement & { entradas?: string[] };
          scope.entradas = [];
          element.addEventListener("animationstart", (event) => {
            const animation = event as AnimationEvent;
            if (animation.animationName === "ld-text-in") {
              const target = event.target as HTMLElement;
              scope.entradas?.push(
                `${animation.animationName} ${getComputedStyle(target).animationDuration} ${getComputedStyle(target).animationTimingFunction} ${target.textContent}`,
              );
            }
          });
        });
        expect(await calls()).toBe(0);
        await page.getByRole("button", { name: "Buscar ahora", exact: true }).click();
        await expect.poll(calls).toBe(2);
        await expect(row).toContainText("Buscando actualizaciones de LensDesk y herramientas…");
        await app.evaluate(() => (globalThis as UpdateFixtureScope).updateCheckFixture?.release());
        const version = await app.evaluate(({ app }) => app.getVersion());
        const final = `LensDesk ${version} está actualizado.`;
        await expect(
          row.locator("[data-swap-new]").getByText(final, { exact: true }),
        ).toBeVisible();
        expect(await calls()).toBe(2);
        const entries = () =>
          row.evaluate((element) => (element as HTMLElement & { entradas?: string[] }).entradas);
        if (reducedMotion === "reduce") expect(await entries()).toEqual([]);
        else
          await expect
            .poll(entries)
            .toEqual([
              expect.stringMatching(
                /^ld-text-in 0\.15s ease-out (LensDesk .* está actualizado\.|No se pudo comprobar)/,
              ),
            ]);
        await app.evaluate(({ BrowserWindow }) => {
          BrowserWindow.getAllWindows()[0]?.webContents.send("update.available", {
            version: "9.0.0",
            html_url: "https://github.com/LensSystems/LensDesk/releases/tag/v9.0.0",
          });
        });
        const link = row.getByRole("link", { name: "Ver novedades", exact: true });
        await expect(link).toBeVisible();
        await expect.poll(() => row.locator(".ld-swap-old").count()).toBe(0);
        await link.hover();
        expect(
          await link.evaluate((element) => {
            const style = getComputedStyle(element);
            const arrow = getComputedStyle(element.querySelector("svg") as SVGElement);
            return [
              style.transitionProperty,
              style.transitionDuration,
              style.transitionTimingFunction,
              arrow.transitionProperty,
              arrow.transitionDuration,
            ];
          }),
        ).toEqual(
          reducedMotion === "reduce"
            ? ["none", "0s", "ease", "none", "0s"]
            : ["text-decoration-color", "0.14s", "ease-out", "transform", "0.14s"],
        );
        await expect(link.locator("svg")).toHaveCSS(
          "transform",
          reducedMotion === "reduce" ? "none" : "matrix(1, 0, 0, 1, 2, -2)",
        );
        await expect(row.locator(".ld-swap-new")).toHaveCount(0);
      } finally {
        try {
          await app.evaluate(() => {
            const fixture = (globalThis as UpdateFixtureScope).updateCheckFixture;
            fixture?.release();
            fixture?.restore();
          });
        } finally {
          await app.close();
        }
      }
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  });
}
