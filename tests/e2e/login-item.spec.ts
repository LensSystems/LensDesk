import { expect, test } from "@playwright/test";
import { launchApp, shellPage } from "./helpers.ts";

test("abrir al iniciar sesión está deshabilitado en desarrollo", async () => {
  const app = await launchApp();
  try {
    const page = await shellPage(app);
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await expect(page.getByRole("switch", { name: "Abrir al iniciar sesión" })).toBeDisabled();
    await expect(page.getByText("Disponible en la app instalada")).toBeVisible();
  } finally {
    await app.close();
  }
});
