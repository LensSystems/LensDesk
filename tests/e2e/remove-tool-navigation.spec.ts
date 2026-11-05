import { mkdir, writeFile } from "node:fs/promises";
import { type ElectronApplication, expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  shellPage,
  toolPage,
} from "./helpers.ts";

const nativeToolViews = (app: ElectronApplication) =>
  app.evaluate(
    ({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.contentView.children.flatMap((view) => {
        const child = view as unknown as {
          webContents?: { getURL(): string };
          getBounds(): { width: number; height: number };
        };
        const url = child.webContents?.getURL();
        return url?.startsWith("lenstool://") ? [{ url, bounds: child.getBounds() }] : [];
      }) ?? [],
  );

for (const scenario of ["no-tab", "active", "inactive", "last-open", "last-closed"] as const) {
  test(`eliminar Notas conserva Herramientas: ${scenario}`, async () => {
    const app = await launchApp();
    try {
      const page = await shellPage(app);
      await enableDeveloperMode(page);
      const last = scenario.startsWith("last");
      if (!last) await installTool(app, page, lenspkgPath("_template"));
      await installTool(app, page, lenspkgPath("notes"), "Notas");
      const opening =
        scenario === "no-tab"
          ? ["Plantilla"]
          : scenario === "active"
            ? ["Plantilla", "Notas"]
            : scenario === "inactive"
              ? ["Notas", "Plantilla"]
              : scenario === "last-open"
                ? ["Notas"]
                : [];
      for (const name of opening) {
        await page.getByRole("button", { name: `Abrir ${name}`, exact: true }).click();
        await page.getByRole("button", { name: "Herramientas", exact: true }).click();
      }
      await expect.poll(() => nativeToolViews(app)).toEqual([]);
      await page.evaluate(() => {
        const scope = window as Window & { removalEvents?: unknown[] };
        scope.removalEvents = [];
        for (const event of ["tabs.changed", "tools.changed"] as const)
          window.lensdeskHost.on(event, (payload) => scope.removalEvents?.push({ event, payload }));
      });
      await page.getByRole("button", { name: "Acciones de Notas", exact: true }).click();
      await page.getByRole("menuitem", { name: "Quitar", exact: true }).click();
      if (scenario === "no-tab") {
        await page
          .getByRole("dialog")
          .getByRole("checkbox", { name: "Eliminar también los datos" })
          .check();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Cancelar", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: "Acciones de Notas", exact: true }),
        ).toBeFocused();
        await expect(page.locator("main article")).toHaveCount(2);
        await page.getByRole("button", { name: "Acciones de Notas", exact: true }).click();
        await page.getByRole("menuitem", { name: "Quitar", exact: true }).click();
        await expect(
          page.getByRole("dialog").getByRole("checkbox", { name: "Eliminar también los datos" }),
        ).not.toBeChecked();
      }
      await page.getByRole("dialog").getByRole("button", { name: "Quitar", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const heading = page.getByRole("heading", { level: 1, name: "Herramientas", exact: true });
      await expect(heading).toBeVisible();
      await expect(heading).toBeFocused();
      await expect.poll(() => nativeToolViews(app)).toEqual([]);
      await expect(page.getByRole("heading", { level: 2, name: "Notas", exact: true })).toHaveCount(
        0,
      );
      await expect(page.locator("main article")).toHaveCount(last ? 0 : 1);
      await expect(
        page.getByRole("button", { name: "Agregar herramienta…", exact: true }),
      ).toBeVisible();
      const directory = test.info().outputPath("remove", scenario);
      await mkdir(directory, { recursive: true });
      await writeFile(
        `${directory}/state.json`,
        JSON.stringify(
          await page.evaluate(async () => ({
            events: (window as Window & { removalEvents?: unknown[] }).removalEvents,
            tabs: await window.lensdeskHost.invoke("tabs.list", {}),
            tools: await window.lensdeskHost.invoke("tools.list", {}),
            main: document.querySelector("main")?.outerHTML,
          })),
          null,
          2,
        ),
      );
      await writeFile(
        `${directory}/native-while-tools.json`,
        JSON.stringify(await nativeToolViews(app)),
      );
      await page.screenshot({ path: `${directory}/after.png` });
      if (!last) {
        await page.getByRole("button", { name: "Abrir Plantilla", exact: true }).click();
        await expect(page.getByRole("main", { name: "Herramienta activa" })).toHaveCount(1);
        const tool = await toolPage(app, "template");
        await expect.poll(() => tool.evaluate(() => document.visibilityState)).toBe("visible");
        await expect(tool.getByRole("heading", { level: 1 })).toBeVisible();
        await expect
          .poll(async () =>
            (await nativeToolViews(app)).some(
              (view) =>
                view.url.startsWith("lenstool://template/") &&
                view.bounds.width > 0 &&
                view.bounds.height > 0,
            ),
          )
          .toBe(true);
        await writeFile(
          `${directory}/native-reopened.json`,
          JSON.stringify(await nativeToolViews(app), null, 2),
        );
        await tool.screenshot({ path: `${directory}/reopened.png` });
      }
    } finally {
      await app.close();
    }
  });
}
