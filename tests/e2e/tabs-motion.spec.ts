import { expect, test } from "@playwright/test";
import { enableDeveloperMode, installTool, launchApp, lenspkgPath, shellPage } from "./helpers.ts";

test("el fondo de la pestaña activa se desliza solo con clic", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    await shell.emulateMedia({ reducedMotion: "no-preference" });
    await enableDeveloperMode(shell);
    await installTool(app, shell, lenspkgPath("notes"), "Notas");
    await installTool(app, shell, lenspkgPath("_template"));
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
    await shell.getByRole("button", { name: "Abrir Plantilla", exact: true }).click();
    const tablist = shell.getByRole("tablist", { name: "Pestañas abiertas" });
    const indicator = tablist.locator(".ld-active-tab-indicator");
    const notes = tablist.getByRole("tab", { name: "Notas", exact: true });
    const template = tablist.getByRole("tab", { name: "Plantilla", exact: true });
    await expect(template).toHaveAttribute("aria-selected", "true");
    await expect(indicator).toHaveAttribute("data-motion", "off");

    // Clic: se desliza 150 ms ease-out.
    await notes.click();
    await expect(notes).toHaveAttribute("aria-selected", "true");
    await expect(indicator).toHaveAttribute("data-motion", "on");
    expect(
      await indicator.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.transitionProperty, style.transitionDuration, style.transitionTimingFunction];
      }),
    ).toEqual(["transform, width", "0.15s, 0.15s", "ease-out, ease-out"]);

    // Teclado en la barra: al instante.
    await template.focus();
    await shell.keyboard.press("Enter");
    await expect(template).toHaveAttribute("aria-selected", "true");
    await expect(indicator).toHaveAttribute("data-motion", "off");
    expect(await indicator.evaluate((element) => element.getAnimations().length)).toBe(0);

    // Cambio que llega del proceso principal (menú Ventana y atajos): al instante.
    await shell.evaluate(() => window.lensdeskHost.invoke("tabs.activate", { toolId: "notes" }));
    await expect(notes).toHaveAttribute("aria-selected", "true");
    await expect(indicator).toHaveAttribute("data-motion", "off");

    // Con reducir movimiento, ningún deslizamiento aunque sea con clic.
    await shell.emulateMedia({ reducedMotion: "reduce" });
    await template.click();
    await expect(template).toHaveAttribute("aria-selected", "true");
    expect(
      await indicator.evaluate((element) => getComputedStyle(element).transitionDuration),
    ).toMatch(/^0s(?:, 0s)*$/);
    expect(await indicator.evaluate((element) => element.getAnimations().length)).toBe(0);
  } finally {
    await app.close().catch(() => undefined);
  }
});
