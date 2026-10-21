import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, installTool, launchApp, lenspkgPath, shellPage } from "./helpers.ts";

test("reordena con puntero y teclado, actualiza el menú y persiste tras reiniciar", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-reorder-"));
  let app = await launchApp({ userDataDir });
  try {
    let shell = await shellPage(app);
    await enableDeveloperMode(shell);
    for (const [directory, name] of [
      ["notes", "Notas"],
      ["md-converter", "Convertidor"],
      ["_template", "Plantilla"],
    ] as const) {
      await installTool(app, shell, lenspkgPath(directory), name);
      await shell.getByRole("button", { name: `Abrir ${name}`, exact: true }).click();
    }
    await expect(shell.getByRole("tab")).toHaveCount(3);
    const original = ["Notas", "Convertidor", "Plantilla"] as const;
    await expect(shell.getByRole("tab")).toHaveText(original);
    const third = await shell.getByRole("tab").nth(2).boundingBox();
    const first = await shell.getByRole("tab").first().boundingBox();
    if (!third || !first) throw new Error("No se encontraron las pestañas");
    await shell.mouse.move(third.x + third.width / 2, third.y + third.height / 2);
    await shell.mouse.down();
    await shell.mouse.move(first.x, first.y + first.height / 2, { steps: 12 });
    await shell.mouse.up();
    const reordered = [original[2], original[0], original[1]];
    await expect(shell.getByRole("tab")).toHaveText(reordered);
    // Ejecuta el mismo callback que el acelerador del menú nativo.
    await app.evaluate(({ Menu }) => {
      const windowMenu = Menu.getApplicationMenu()?.items.find((item) => item.label === "Ventana");
      const second = windowMenu?.submenu?.items.find((item) => item.accelerator === "CmdOrCtrl+2");
      if (!second) throw new Error("No existe el atajo de la segunda pestaña");
      second.click();
    });
    await expect(shell.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
    await app.close();
    app = await launchApp({ userDataDir });
    shell = await shellPage(app);
    await expect(shell.getByRole("tab")).toHaveText(reordered);
    const tab = shell.getByRole("tab").first();
    await tab.focus();
    await shell.keyboard.press("Control+Shift+ArrowRight");
    await expect(shell.getByRole("tab")).toHaveText([original[0], original[2], original[1]]);
    await expect(shell.getByRole("tab").nth(1)).toBeFocused();
    await expect(shell.locator('[aria-live="polite"]')).toContainText("pestaña 2 de 3");
    await shell.keyboard.press("Control+Shift+ArrowLeft");
    await expect(shell.getByRole("tab")).toHaveText(reordered);
    // Quitar la primera herramienta abierta también actualiza el menú Ventana.
    await shell.evaluate(() =>
      (
        window as unknown as {
          lensdeskHost: { invoke(channel: string, payload: unknown): Promise<unknown> };
        }
      ).lensdeskHost.invoke("tools.remove", { toolId: "template", deleteData: true }),
    );
    await expect(shell.getByRole("tab")).toHaveText([original[0], original[1]]);
    await expect
      .poll(() =>
        app.evaluate(({ Menu }) =>
          Menu.getApplicationMenu()
            ?.items.find((item) => item.label === "Ventana")
            ?.submenu?.items.filter((item) => item.accelerator?.startsWith("CmdOrCtrl+"))
            .map((item) => `${item.accelerator} ${item.label}`),
        ),
      )
      .toEqual(["CmdOrCtrl+1 Notas", "CmdOrCtrl+2 Convertidor"]);
  } finally {
    await app.close();
  }
});
