import { expect, test } from "@playwright/test";
import { launchApp, shellPage } from "./helpers.ts";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`el texto de actualizaciones y los enlaces respetan movimiento ${reducedMotion}`, async () => {
    const app = await launchApp();
    try {
      const page = await shellPage(app);
      await expect(page.getByRole("heading", { name: "Herramientas", exact: true })).toBeVisible();
      // Respuesta local de la consulta de versiones: ninguna petición sale de la máquina.
      await app.evaluate(() => {
        globalThis.fetch = async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return new Response(
            JSON.stringify({
              tag_name: "v0.0.1",
              html_url: "https://github.com/LensSystems/LensDesk/releases/tag/v0.0.1",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        };
      });
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
      await page.getByRole("button", { name: "Buscar ahora", exact: true }).click();
      // La búsqueda del arranque puede seguir en curso y la manual reutiliza su resultado: cualquier
      // estado final sirve, los dos entran con la misma transición.
      const final = /^(LensDesk está actualizado|No se pudo comprobar)/;
      await expect(row.locator("[data-swap-new]").getByText(final)).toBeVisible();
      const entries = () =>
        row.evaluate((element) => (element as HTMLElement & { entradas?: string[] }).entradas);
      if (reducedMotion === "reduce") expect(await entries()).toEqual([]);
      else
        await expect
          .poll(entries)
          .toEqual([
            expect.stringMatching(
              /^ld-text-in 0\.15s ease-out (LensDesk está actualizado|No se pudo comprobar)/,
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
      await app.close();
    }
  });
}
