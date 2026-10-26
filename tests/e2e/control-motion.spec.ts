import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Locator, test } from "@playwright/test";
import { installTool, launchApp, lenspkgPath, shellPage } from "./helpers.ts";

async function motion(control: Locator, pseudo: string) {
  return control.evaluate((element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    return {
      property: style.transitionProperty,
      duration: style.transitionDuration,
      easing: style.transitionTimingFunction,
      animation: style.animationName,
      animationDuration: style.animationDuration,
    };
  }, pseudo);
}

test("interruptor y casilla respetan los tiempos y reducir movimiento", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-controls-"));
  const app = await launchApp({ userDataDir });
  try {
    const page = await shellPage(app);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    const toggle = page.getByRole("switch", { name: "Modo desarrollador" });
    await toggle.click();
    await expect(toggle).toBeChecked();
    expect(await motion(toggle, "::before")).toMatchObject({
      property: "transform, background-color",
      duration: "0.15s, 0.15s",
      easing: "ease-out, ease-out",
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await toggle.click();
    expect((await motion(toggle, "::before")).duration).toMatch(/^0s(?:, 0s)*$/);
    await toggle.click();
    await installTool(app, page, lenspkgPath("_template"));
    await page.getByRole("button", { name: "Acciones de Plantilla", exact: true }).click();
    await page.getByRole("menuitem", { name: "Quitar", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Quitar Plantilla" });
    const checkbox = dialog.getByRole("checkbox", { name: "Eliminar también los datos" });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    expect((await motion(checkbox, "::after")).animation).toBe("none");
    // El dibujo dura 160 ms y se apaga al terminar: se anota en cuanto empieza.
    await checkbox.evaluate((element) => {
      const scope = element as HTMLElement & { drawn?: string[] };
      scope.drawn = [];
      element.addEventListener("animationstart", (event) => {
        const style = getComputedStyle(element, "::after");
        scope.drawn?.push(`${(event as AnimationEvent).animationName} ${style.animationDuration}`);
      });
    });
    await checkbox.click();
    expect(await motion(checkbox, "::before")).toMatchObject({
      duration: "0.16s, 0.16s",
      easing: "ease-out, ease-out",
    });
    await expect
      .poll(() =>
        checkbox.evaluate((element) => (element as HTMLElement & { drawn?: string[] }).drawn),
      )
      .toEqual(["ld-palomita 0.16s"]);
    await expect.poll(async () => (await motion(checkbox, "::after")).animation).toBe("none");
    await checkbox.click();
    expect((await motion(checkbox, "::before")).duration).toBe("0.12s, 0.12s");
    expect(await motion(checkbox, "::after")).toMatchObject({
      animation: "none",
      duration: "0.12s",
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const checked of [true, false]) {
      await checkbox.setChecked(checked);
      for (const pseudo of ["::before", "::after"]) {
        const style = await motion(checkbox, pseudo);
        expect(style.duration).toMatch(/^0s(?:, 0s)*$/);
        expect(style.animation).toBe("none");
      }
    }
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Abrir Plantilla", exact: true })).toBeVisible();
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
