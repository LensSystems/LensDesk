import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, installTool, launchApp, toolPage } from "./helpers.ts";

test("la plantilla reinicia el backend después de terminar el proceso", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-backend-e2e-"));
  const pkg = resolve(import.meta.dirname, "../../tools/_template/dist/template-0.1.0.lenspkg");
  const app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await installTool(app, shell, pkg);
    await shell.getByRole("button", { name: "Plantilla", exact: true }).click();
    const tool = await toolPage(app, "template");
    const ping = async () => {
      const output = tool.locator("output");
      const previous = (await output.count()) > 0 ? await output.textContent() : null;
      await tool.getByRole("button", { name: "Probar backend" }).click();
      await expect(output).toContainText("Respuesta correcta");
      if (previous) await expect(output).not.toHaveText(previous);
    };
    await ping();
    const backendPid = () =>
      app.evaluate(({ app: electronApp }) => {
        const match = electronApp
          .getAppMetrics()
          .find(
            (metric) =>
              metric.type === "Utility" &&
              /lensdesk-tool-template/.test(
                `${metric.name} ${("serviceName" in metric ? metric.serviceName : "") ?? ""}`,
              ),
          );
        return match?.pid;
      });
    const utilityPid = await backendPid();
    expect(utilityPid).toBeTruthy();
    if (!utilityPid) throw new Error("No se encontró el proceso utility del backend de plantilla.");
    process.kill(utilityPid);
    // Espera a que main vea la salida del proceso antes de volver a llamar al backend.
    await expect.poll(backendPid).not.toBe(utilityPid);
    await ping();
    expect(await backendPid()).not.toBe(utilityPid);
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
