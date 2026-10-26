import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  shellPage,
  toolPage,
} from "./helpers.ts";

test("corrector local sin descargas y menú de insertar", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    await enableDeveloperMode(shell);
    await installTool(app, shell, lenspkgPath("notes"), "Notas");
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const notes = await toolPage(app, "notes");
    await notes.getByRole("heading", { name: "Guía de Markdown" }).waitFor();
    await notes.getByRole("button", { name: "Nueva nota" }).first().click();
    await notes.getByRole("textbox", { name: "Título de la nota" }).waitFor();
    await app.evaluate(({ session }) => {
      const target = globalThis as typeof globalThis & { spellingDownloads: number };
      target.spellingDownloads = 0;
      for (const current of [session.defaultSession, session.fromPartition("persist:tool-notes")])
        current.on("spellcheck-dictionary-download-begin", () => {
          target.spellingDownloads++;
        });
    });
    await notes
      .getByRole("textbox", { name: "Título de la nota" })
      .fill("Holaa errror ortográffico");
    const editor = notes.locator(".cm-content");
    await editor.fill("Holaa errror ortográffico");
    await editor.click({ button: "right" });
    await expect(notes.getByRole("menu", { name: "Menú de edición", exact: true })).toBeVisible();
    const state = await app.evaluate(({ session }) => ({
      downloads: (globalThis as typeof globalThis & { spellingDownloads: number })
        .spellingDownloads,
      platform: process.platform,
      shell: session.defaultSession.isSpellCheckerEnabled(),
      notes: session.fromPartition("persist:tool-notes").isSpellCheckerEnabled(),
      // Sin idiomas no hay diccionario que descargar, ni siquiera al crear la sesión.
      languages: [
        ...session.defaultSession.getSpellCheckerLanguages(),
        ...session.fromPartition("persist:tool-notes").getSpellCheckerLanguages(),
      ],
    }));
    expect(state.downloads).toBe(0);
    if (state.platform === "win32" || state.platform === "linux") {
      expect(state.shell).toBe(false);
      expect(state.notes).toBe(false);
      expect(state.languages).toEqual([]);
    }
    if (state.platform === "darwin") expect(state.notes).toBe(true);
  } finally {
    await app.close();
  }
});
