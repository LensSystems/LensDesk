import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import { launchApp, shellPage } from "./helpers.ts";

let galleryServer: ViteDevServer;
let galleryUrl: string;
test.beforeAll(async () => {
  galleryServer = await createServer({
    configFile: fileURLToPath(new URL("../../packages/ui/gallery/vite.config.ts", import.meta.url)),
    server: { host: "127.0.0.1", port: 0 },
  });
  await galleryServer.listen();
  const address = galleryServer.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Gallery address unavailable");
  galleryUrl = `http://127.0.0.1:${address.port}/`;
});
test.afterAll(async () => {
  await galleryServer?.close();
});

async function expectDirection(icon: Locator, up: boolean) {
  await expect
    .poll(() =>
      icon.evaluate((element, up) => {
        const matrix = new DOMMatrix(getComputedStyle(element).transform);
        return Math.abs(matrix.a - (up ? -1 : 1)) < 0.001 && Math.abs(matrix.b) < 0.001;
      }, up),
    )
    .toBe(true);
}
async function expectUnoccluded(trigger: Locator) {
  await trigger.evaluate(async () => {
    const popup = document.querySelector('[role="listbox"]');
    await Promise.all(
      popup
        ?.getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)) ?? [],
    );
  });
  await expect
    .poll(() =>
      trigger.evaluate((element) => {
        const icon = element.querySelector("svg")?.getBoundingClientRect();
        const popup = document.querySelector('[role="listbox"]')?.getBoundingClientRect();
        const field = element.getBoundingClientRect();
        return (
          !!icon &&
          !!popup &&
          getComputedStyle(element.querySelector("svg") as SVGElement).visibility === "visible" &&
          getComputedStyle(element.querySelector("svg") as SVGElement).opacity === "1" &&
          (popup.bottom <= field.top ||
            popup.top >= field.bottom ||
            popup.right <= field.left ||
            popup.left >= field.right)
        );
      }),
    )
    .toBe(true);
}
const geometry = async (trigger: Locator) =>
  trigger.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const svg = element.querySelector("svg")?.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      contained:
        !!svg &&
        svg.left >= rect.left &&
        svg.right <= rect.right &&
        svg.top >= rect.top &&
        svg.bottom <= rect.bottom,
    };
  });
for (const theme of ["light", "dark"] as const)
  for (const accent of ["blue", "green"] as const)
    for (const width of [1280, 760]) {
      test(`selector B ${theme}/${accent}/${width}`, async () => {
        const app = await launchApp();
        try {
          const shell = await shellPage(app);
          await shell.evaluate(
            async ({ theme, accent }) => {
              await window.lensdeskHost.invoke("settings.set", { key: "theme", value: theme });
              await window.lensdeskHost.invoke("settings.set", { key: "accent", value: accent });
            },
            { theme, accent },
          );
          const browserWindow = await app.browserWindow(shell);
          await browserWindow.evaluate(
            (window, width) => window.setSize(width, width === 760 ? 520 : 800),
            width,
          );
          const reduced = width === 760;
          await shell.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
          await shell.getByRole("button", { name: "Ajustes", exact: true }).click();
          await expect(shell.getByRole("heading", { name: "Ajustes", exact: true })).toBeFocused();
          await shell.keyboard.press("Tab");
          const language = shell.locator(".ld-select-trigger");
          await expect(language).toBeFocused();
          const icon = shell.locator(".ld-select-chevron");
          await expect(icon).toHaveAttribute("focusable", "false");
          await expectDirection(icon, false);
          const baseline = await geometry(language);
          expect(baseline.contained).toBe(true);
          const directory = test.info().outputPath("selector", `${theme}-${accent}-${width}`);
          await mkdir(directory, { recursive: true });
          await shell.screenshot({ path: join(directory, "app-closed.png") });
          await language.press("Enter");
          await expect(shell.getByRole("option", { name: "Español", exact: true })).toBeFocused();
          await expectDirection(icon, true);
          await expectUnoccluded(language);
          expect(await geometry(language)).toEqual(baseline);
          await shell.screenshot({ path: join(directory, "app-open.png") });
          await shell.getByRole("option", { name: "Español", exact: true }).press("Escape");
          await expectDirection(icon, false);
          await expect(language).toBeFocused();
          expect(await geometry(language)).toEqual(baseline);
          await language.press("Enter");
          await shell.getByRole("option", { name: "Español", exact: true }).press("ArrowDown");
          await shell.getByRole("option", { name: "Inglés", exact: true }).press("Enter");
          await expect(shell.getByRole("combobox", { name: "Language", exact: true })).toHaveText(
            "English",
          );
          const appMetrics = await icon.evaluate((element) => ({
            width: getComputedStyle(element).width,
            height: getComputedStyle(element).height,
            stroke: element.getAttribute("stroke-width"),
            path: element.querySelector("path")?.getAttribute("d"),
            color: getComputedStyle(element).color,
          }));
          const opened = app.waitForEvent("window");
          await app.evaluate(
            ({ BrowserWindow }, { width, galleryUrl }) => {
              const gallery = new BrowserWindow({
                width,
                height: width === 760 ? 520 : 800,
                webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
              });
              void gallery.loadURL(galleryUrl);
            },
            { width, galleryUrl },
          );
          const gallery = await opened;
          await gallery.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
          const column = gallery.locator(`article[data-theme="${theme}"]`);
          const accentTrigger = column.getByRole("combobox", {
            name: `Acento del tema ${theme}`,
            exact: true,
          });
          if (accent === "green") {
            await accentTrigger.click();
            await gallery.getByRole("option", { name: "Verde", exact: true }).click();
            await expect(gallery.locator('[role="listbox"]')).toHaveCount(0);
            await expect(accentTrigger).toBeFocused();
          }
          const mode = column.locator('[role="combobox"][aria-label="Modo Normal"]');
          await mode.scrollIntoViewIfNeeded();
          await mode.focus();
          await mode.press("Tab");
          await expect(
            column.getByRole("combobox", { name: "Modo Hover simulado", exact: true }),
          ).toBeFocused();
          await gallery.keyboard.press("Shift+Tab");
          await expect(mode).toBeFocused();
          const genericIcon = mode.locator(".ld-select-chevron");
          const metrics = await genericIcon.evaluate((element) => ({
            width: getComputedStyle(element).width,
            height: getComputedStyle(element).height,
            stroke: element.getAttribute("stroke-width"),
            path: element.querySelector("path")?.getAttribute("d"),
            color: getComputedStyle(element).color,
          }));
          expect(metrics).toEqual(appMetrics);
          expect(
            await mode.evaluate((element) =>
              Number.parseFloat(getComputedStyle(element).outlineWidth),
            ),
          ).toBeGreaterThan(0);
          const before = await geometry(mode);
          expect(before.contained).toBe(true);
          await gallery.screenshot({ path: join(directory, "gallery-closed.png") });
          await mode.press("Enter");
          await expectDirection(genericIcon, true);
          await expectUnoccluded(mode);
          expect(await geometry(mode)).toEqual(before);
          await gallery.screenshot({ path: join(directory, "gallery-open.png") });
          await gallery.getByRole("option", { name: "Lectura", exact: true }).press("Escape");
          await expectDirection(genericIcon, false);
          await expect(mode).toBeFocused();
          const transition = await genericIcon.evaluate((element) => ({
            duration: Number.parseFloat(getComputedStyle(element).transitionDuration),
            token:
              Number.parseFloat(getComputedStyle(element).getPropertyValue("--ld-motion-fast")) /
              1000,
          }));
          expect(transition.duration).toBe(reduced ? 0 : transition.token);
          await mode.hover();
          await expect
            .poll(() =>
              mode.evaluate(
                (element) =>
                  getComputedStyle(element).borderTopColor ===
                  getComputedStyle(element.querySelector("svg") as SVGElement).color,
              ),
            )
            .toBe(true);
          const focus = column.getByRole("combobox", { name: "Modo Foco", exact: true });
          await focus.focus();
          await gallery.keyboard.press("Tab");
          const error = column.getByRole("combobox", { name: "Modo Error", exact: true });
          await expect(error).toBeFocused();
          await expect(
            column.getByRole("combobox", { name: "Modo Deshabilitado", exact: true }),
          ).toBeDisabled();
          await expect(error).toHaveAccessibleDescription("Elige un modo disponible.");
          const errorBorder = await error.evaluate(
            (element) => getComputedStyle(element).borderTopColor,
          );
          await error.hover();
          expect(await error.evaluate((element) => getComputedStyle(element).borderTopColor)).toBe(
            errorBorder,
          );
          const long = column.getByRole("combobox", { name: "Modo Valor largo", exact: true });
          expect((await geometry(long)).contained).toBe(true);
          await long.press("Enter");
          const option = gallery.getByRole("option", {
            name: "Modo de lectura con un nombre de proyecto deliberadamente largo",
            exact: true,
          });
          await expect(option).toBeVisible();
          const box = await option.boundingBox();
          expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
          await option.press("Escape");
          await expect(gallery.locator('[role="listbox"]')).toHaveCount(0);
          await expect(long).toBeFocused();
          await gallery.screenshot({ path: join(directory, "gallery-states.png") });
          await expect
            .poll(() => column.evaluate((element) => element.scrollWidth <= element.clientWidth))
            .toBe(true);
        } finally {
          await app.close();
        }
      });
    }
