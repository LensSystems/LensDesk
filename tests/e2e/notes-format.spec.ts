import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  shellPage,
  toolPage,
} from "./helpers.ts";

test("historial con botones y teclado, formato y reinicio entre notas", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    await enableDeveloperMode(shell);
    await installTool(app, shell, lenspkgPath("notes"), "Notas");
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const notes = await toolPage(app, "notes");
    const create = notes.getByRole("button", { name: "Nueva nota" }).first();
    await create.click();
    const undo = notes.getByRole("button", { name: "Deshacer", exact: true });
    const redo = notes.getByRole("button", { name: "Rehacer", exact: true });
    const editor = notes.locator(".cm-content");
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();
    await editor.fill("Texto");
    await undo.click();
    await expect(editor).toHaveText("");
    await expect(undo).toBeDisabled();
    await redo.click();
    await expect(editor).toHaveText("Texto");
    await editor.press("ControlOrMeta+z");
    await expect(editor).toHaveText("");
    await editor.press("ControlOrMeta+Shift+z");
    await expect(editor).toHaveText("Texto");
    await editor.press("ControlOrMeta+z");
    await editor.press("Control+y");
    await expect(editor).toHaveText("Texto");
    await editor.press("ControlOrMeta+a");
    await editor.press("ControlOrMeta+b");
    await expect(editor).toHaveText("**Texto**");
    await editor.press("ControlOrMeta+b");
    await expect(editor).toHaveText("Texto");
    await notes.getByRole("button", { name: "Formato", exact: true }).click();
    await notes.getByRole("menuitem", { name: "Subrayado", exact: false }).click();
    await expect(editor).toHaveText("<u>Texto</u>");
    await editor.fill("palabra ".repeat(80));
    const bar = await undo.locator("..").boundingBox();
    const text = await notes.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(".cm-line") as Node);
      return Math.max(...[...range.getClientRects()].map((rect) => rect.right));
    });
    expect(bar).not.toBeNull();
    expect(text).toBeLessThan(bar?.x ?? 0);
    await create.click();
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();
    await expect(editor).toHaveText("");
  } finally {
    await app.close();
  }
});
