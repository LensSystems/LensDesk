import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  shellPage,
  toolPage,
} from "./helpers.ts";

async function processes(app: ElectronApplication) {
  return app.evaluate(({ app }) =>
    app.getAppMetrics().map(({ pid, type, name }) => ({ pid, type, name })),
  );
}

function counts(metrics: Awaited<ReturnType<typeof processes>>) {
  return {
    utility: metrics.filter(({ type }) => type === "Utility").length,
    renderers: metrics.filter(({ type }) => type === "Tab").length,
  };
}

for (const action of ["close", "disable", "remove"] as const) {
  const description = {
    close: "cerrar todas las pestañas",
    disable: "desactivar una herramienta",
    remove: "quitar una herramienta",
  }[action];
  test(`libera los procesos de herramientas al ${description}`, async () => {
    const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-processes-"));
    const app = await launchApp({ userDataDir });
    try {
      const shell = await shellPage(app);
      await enableDeveloperMode(shell);
      await expect(shell.getByRole("tab")).toHaveCount(0);
      const baseline = await processes(app);
      const baselineCounts = counts(baseline);
      const pages: Page[] = [];
      if (action === "close") {
        await installTool(app, shell, lenspkgPath("notes"), "Notas");
        await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
        pages.push(await toolPage(app, "notes"));
        // Notas carga sus datos mediante el backend al abrirse.
        await expect
          .poll(async () =>
            (await processes(app)).some(
              ({ type, name }) => type === "Utility" && name === "lensdesk-tool-notes",
            ),
          )
          .toBe(true);
      }
      await installTool(app, shell, lenspkgPath("_template"));
      await shell.getByRole("button", { name: "Abrir Plantilla", exact: true }).click();
      const template = await toolPage(app, "template");
      pages.push(template);
      await template.getByRole("button", { name: "Probar backend" }).click();
      await expect(template.locator("output")).toContainText("Respuesta correcta");
      const toolCount = action === "close" ? 2 : 1;
      await expect
        .poll(async () => counts(await processes(app)))
        .toEqual({
          utility: baselineCounts.utility + toolCount,
          renderers: baselineCounts.renderers + toolCount,
        });
      const opened = await processes(app);
      const baselinePids = new Set(baseline.map(({ pid }) => pid));
      const toolPids = opened
        .filter(({ pid, type }) => !baselinePids.has(pid) && (type === "Utility" || type === "Tab"))
        .map(({ pid }) => pid);
      expect(toolPids).toHaveLength(toolCount * 2);

      if (action === "close") {
        for (const name of ["Plantilla", "Notas"]) {
          await shell.getByRole("tab", { name, exact: true }).hover();
          await shell.getByRole("button", { name: `Cerrar ${name}`, exact: true }).click();
        }
      } else {
        const result = await shell.evaluate(async (action) => {
          const host = (
            window as unknown as {
              lensdeskHost: {
                invoke(channel: string, payload: unknown): Promise<{ ok: boolean }>;
              };
            }
          ).lensdeskHost;
          return action === "disable"
            ? host.invoke("tools.setEnabled", { toolId: "template", enabled: false })
            : host.invoke("tools.remove", { toolId: "template", deleteData: true });
        }, action);
        expect(result.ok).toBe(true);
      }
      // Desactivar conserva la pestaña (para reactivarla) pero cierra su vista y su backend.
      await expect(shell.getByRole("tab")).toHaveCount(action === "disable" ? 1 : 0);
      await expect.poll(() => pages.every((page) => page.isClosed())).toBe(true);
      await expect
        .poll(async () => {
          const remaining = await processes(app);
          return {
            ...counts(remaining),
            survivingToolPids: remaining.filter(({ pid }) => toolPids.includes(pid)),
          };
        })
        .toEqual({ ...baselineCounts, survivingToolPids: [] });
      await test.info().attach("procesos-antes-y-después", {
        body: JSON.stringify({ baseline, opened, after: await processes(app) }, null, 2),
        contentType: "application/json",
      });
    } finally {
      await app.close().catch(() => undefined);
      await rm(userDataDir, { recursive: true, force: true });
    }
  });
}
