import { expect, test } from "@playwright/test";
import { launchApp, shellPage } from "./helpers.ts";

for (const width of [1280, 760]) {
  test(`el aviso lleva a Ajustes en una columna a ${width}px`, async () => {
    const app = await launchApp();
    try {
      const shell = await shellPage(app);
      const rendererRequests: string[] = [];
      shell.on("request", (request) => {
        if (/^https?:/.test(request.url())) rendererRequests.push(request.url());
      });
      await app.evaluate(() => {
        const scope = globalThis as typeof globalThis & { updateTestRequests: string[] };
        scope.updateTestRequests = [];
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (...args) => {
          scope.updateTestRequests.push(String(args[0]));
          return originalFetch(...args);
        };
      });
      const window = await app.browserWindow(shell);
      await window.evaluate(
        (browserWindow, width) => browserWindow.setContentSize(width, width === 760 ? 520 : 980),
        width,
      );
      await expect(shell.getByRole("heading", { name: "Herramientas", exact: true })).toBeVisible();
      for (let index = 0; index < 2; index++) {
        const version = `9.${width}.${index + 1}`;
        await app.evaluate(({ BrowserWindow }, version) => {
          BrowserWindow.getAllWindows()[0]?.webContents.send("update.available", {
            version,
            html_url: `https://github.com/LensSystems/LensDesk/releases/tag/v${version}`,
            installerUrl: `https://github.com/LensSystems/LensDesk/releases/download/v${version}/installer.dmg`,
          });
        }, version);
        await shell.getByRole("button", { name: "Ir a Ajustes", exact: true }).click();
        await expect(shell.getByRole("heading", { name: "Ajustes", exact: true })).toBeVisible();
        const row = shell.locator("[data-update-row]");
        await expect(row).toBeInViewport();
        await expect(row).toHaveAttribute("data-highlighted", "true");
        const link = shell.getByRole("link", {
          name: `Versión ${version} disponible`,
          exact: true,
        });
        await expect(link).toBeFocused();
        await expect(shell.locator("header [data-notice-capsule]")).toHaveCount(0);
        await expect
          .poll(() =>
            shell.locator("main section").evaluateAll((sections) => {
              const boxes = sections.map((section) => section.getBoundingClientRect());
              const first = boxes[0];
              return (
                !!first &&
                boxes.length === 4 &&
                boxes.every(
                  (box, index) =>
                    Math.abs(box.left - first.left) < 1 &&
                    Math.abs(box.width - first.width) < 1 &&
                    (index === 0 || box.top > (boxes[index - 1]?.bottom ?? 0)),
                )
              );
            }),
          )
          .toBe(true);
        await expect
          .poll(() =>
            shell
              .locator("main section")
              .first()
              .evaluate((section) => section.getBoundingClientRect().width),
          )
          .toBeGreaterThan(width === 1280 ? 670 : 660);
        await expect
          .poll(() =>
            shell
              .locator("main section")
              .first()
              .evaluate((section) => section.getBoundingClientRect().width),
          )
          .toBeLessThanOrEqual(width === 1280 ? 672 : 686);
        await expect(row).toHaveAttribute("data-highlighted", "false");
        await expect(link).toBeVisible();
        await expect(link).toBeFocused();
        await shell.screenshot({ path: test.info().outputPath(`ajustes-${width}-${index}.png`) });
      }
      expect(rendererRequests).toEqual([]);
      // Solo se admite la consulta diaria de versiones que la app ya hace al arrancar.
      const mainRequests = await app.evaluate(
        () =>
          (globalThis as typeof globalThis & { updateTestRequests: string[] }).updateTestRequests,
      );
      expect(
        mainRequests.filter(
          (url) => !/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases\/latest$/.test(url),
        ),
      ).toEqual([]);
    } finally {
      await app.close();
    }
  });
}

test("el tema desliza la píldora solo con puntero y movimiento permitido", async () => {
  const app = await launchApp();
  try {
    const page = await shellPage(app);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    const group = page.getByRole("radiogroup", { name: "Tema", exact: true });
    const pill = group.locator(".ld-indicator");
    await expect(pill).toBeVisible();
    await expect(group).toHaveAttribute("data-motion", "off");
    await group.getByRole("radio", { name: "Claro", exact: true }).click();
    await group.getByRole("radio", { name: "Oscuro", exact: true }).click();
    await expect(group).toHaveAttribute("data-motion", "on");
    await expect
      .poll(() =>
        pill.evaluate((element) => {
          const style = getComputedStyle(element);
          return [
            style.transitionProperty,
            style.transitionDuration,
            style.transitionTimingFunction,
          ];
        }),
      )
      .toEqual(["transform, width", "0.15s, 0.15s", "ease-out, ease-out"]);
    await group.getByRole("radio", { name: "Oscuro", exact: true }).press("ArrowLeft");
    await expect(group).toHaveAttribute("data-motion", "off");
    await expect.poll(() => pill.evaluate((element) => element.getAnimations().length)).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await group.getByRole("radio", { name: "Oscuro", exact: true }).click();
    await expect.poll(() => pill.evaluate((element) => element.getAnimations().length)).toBe(0);
    await expect
      .poll(() => pill.evaluate((element) => getComputedStyle(element).transitionDuration))
      .toBe("0s");
  } finally {
    await app.close();
  }
});
