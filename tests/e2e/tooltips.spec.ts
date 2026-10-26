import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { launchApp, shellPage } from "./helpers.ts";

test("las etiquetas de la cabecera cambian sin espera y se cierran al salir", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-tooltips-"));
  const app = await launchApp({ userDataDir });
  try {
    const page = await shellPage(app);
    const settings = page.getByRole("button", { name: "Ajustes", exact: true });
    const tools = page.getByRole("button", { name: "Herramientas", exact: true });
    const settingsTip = page.locator(".ld-tooltip").filter({ hasText: "Ajustes" });
    await settings.hover();
    await expect(settingsTip).toBeVisible();
    const box = await tools.boundingBox();
    if (!box) throw new Error("No se encontró el botón Herramientas");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await expect(settingsTip).not.toBeVisible({ timeout: 150 });
    await expect(page.locator(".ld-tooltip").filter({ hasText: "Herramientas" })).toBeVisible({
      timeout: 150,
    });
    await page.evaluate(() => {
      document.documentElement.dispatchEvent(new MouseEvent("mouseleave"));
    });
    await expect(page.locator(".ld-tooltip")).not.toBeVisible({ timeout: 150 });
    // Con foco de teclado la etiqueta sigue visible aunque el ratón salga de la ventana.
    // Primer foco de teclado tras salir de la ventana: la etiqueta aparece.
    await page.getByRole("heading", { name: "Herramientas", exact: true }).click();
    await page.evaluate(() => {
      document.documentElement.dispatchEvent(new MouseEvent("mouseleave"));
    });
    await page.evaluate(() => {
      const tools = document.querySelector<HTMLElement>('button[aria-label="Herramientas"]');
      tools?.focus();
    });
    await page.keyboard.press("Tab");
    await expect(settings).toBeFocused();
    const focusedTip = page.locator(".ld-tooltip").filter({ hasText: "Ajustes" });
    await expect(focusedTip).toBeVisible();
    // Con foco de teclado, ni salir del botón ni de la ventana la cierra; Escape sí.
    const box2 = await settings.boundingBox();
    if (!box2) throw new Error("No se encontró el botón Ajustes");
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await page.mouse.move(box2.x + box2.width / 2, 300, { steps: 4 });
    await page.evaluate(() => {
      document.documentElement.dispatchEvent(new MouseEvent("mouseleave"));
    });
    await page.waitForTimeout(300);
    await expect(focusedTip).toBeVisible();
    // El ratón vuelve a la ventana (simulado: Chromium no sabe que salió).
    await page.evaluate(() => {
      document.documentElement.dispatchEvent(new PointerEvent("pointerenter"));
    });
    // Pasar el ratón por otro botón cierra la etiqueta enfocada: nunca hay dos a la vez.
    const box3 = await tools.boundingBox();
    if (!box3) throw new Error("No se encontró el botón Herramientas");
    await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2, { steps: 4 });
    await expect(page.locator(".ld-tooltip").filter({ hasText: "Herramientas" })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator(".ld-tooltip")).toHaveCount(1);
    await page.mouse.move(box3.x + box3.width / 2, 300, { steps: 4 });
    await page.keyboard.press("Escape");
    await expect(page.locator(".ld-tooltip")).toHaveCount(0, { timeout: 500 });
    // Paso directo del botón enfocado al vecino: solo queda la etiqueta del vecino.
    await settings.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(focusedTip).toBeVisible();
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2, { steps: 6 });
    await page.waitForTimeout(400);
    await expect(page.locator(".ld-tooltip")).toHaveCount(1);
    await expect(page.locator(".ld-tooltip").filter({ hasText: "Herramientas" })).toBeVisible();
  } finally {
    await app.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});
