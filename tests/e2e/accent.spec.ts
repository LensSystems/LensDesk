import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { enableDeveloperMode, launchApp, shellPage, stubDialog, toolPage } from "./helpers.ts";

test("el acento cambia en Notas abierta y persiste al reiniciar", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-accent-e2e-"));
  const pkg = resolve(import.meta.dirname, "../../tools/notes/dist/notes-0.1.0.lenspkg");
  let app = await launchApp({ userDataDir });
  try {
    let shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [pkg] });
    await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const notes = await toolPage(app, "notes");
    await expect(notes.locator("html")).not.toHaveAttribute("data-accent", "green");
    await shell.getByRole("button", { name: "Ajustes", exact: true }).click();
    await shell
      .getByRole("radiogroup", { name: "Color de acento", exact: true })
      .getByRole("radio", { name: "Verde", exact: true })
      .click();
    await expect(shell.locator("html")).toHaveAttribute("data-accent", "green");
    await expect(notes.locator("html")).toHaveAttribute("data-accent", "green");
    await shell.getByRole("tab", { name: /Notas/ }).click();
    await expect(notes.locator("html")).toHaveAttribute("data-accent", "green");
    await app.close();
    app = await launchApp({ userDataDir });
    shell = await shellPage(app);
    const reopened = await toolPage(app, "notes");
    await expect(shell.locator("html")).toHaveAttribute("data-accent", "green");
    await expect(reopened.locator("html")).toHaveAttribute("data-accent", "green");
    await shell.getByRole("button", { name: "Ajustes", exact: true }).click();
    await expect(shell.getByRole("radio", { name: "Verde", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
