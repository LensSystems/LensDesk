import { defineConfig } from "@playwright/test";

// No hay navegadores que descargar: las pruebas manejan el binario de Electron (_electron).
// Requisito: `pnpm build` y los .lenspkg de las herramientas deben existir antes de ejecutar.
const ignored = ["**/node_modules/**"];

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "app", testIgnore: [...ignored, "**/packaged.spec.ts"] },
    { name: "packaged", testMatch: ["**/packaged.spec.ts"], testIgnore: ignored },
  ],
});
