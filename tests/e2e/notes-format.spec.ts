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
    // Ya existe la guía: se espera a que el editor de la nota nueva sustituya al suyo.
    await notes.getByRole("heading", { name: "Guía de Markdown" }).waitFor();
    await create.click();
    await notes.getByRole("textbox", { name: "Título de la nota" }).waitFor();
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
    await editor.fill(
      "# Título\n\nPárrafo\ncontinuación\n\n- uno\n- dos\n\n> cita\n> continuación",
    );
    const lines = editor.locator(".cm-line");
    await expect(lines).toHaveCount(10);
    for (let index = 0; index < 10; index++) {
      if ([0, 5, 8].includes(index)) {
        await expect(lines.nth(index)).toHaveClass(/cm-block-start/);
      } else {
        await expect(lines.nth(index)).not.toHaveClass(/cm-block-start/);
      }
    }
    // Los números de línea de los inicios de bloque bajan igual que su texto.
    const numbers = notes.locator(".cm-lineNumbers .cm-gutterElement.cm-block-start");
    await expect(numbers).toHaveCount(3);
    const [number, line] = await Promise.all([
      numbers.nth(1).boundingBox(),
      lines.nth(5).boundingBox(),
    ]);
    expect(Math.abs((number?.y ?? 0) - (line?.y ?? 99))).toBeLessThan(1);
    expect(Math.abs((number?.height ?? 0) - (line?.height ?? 99))).toBeLessThan(1);
    const spacing = await editor.evaluate((element) => {
      const content = getComputedStyle(element);
      const block = getComputedStyle(element.querySelector(".cm-block-start") as Element);
      return {
        ratio: Number.parseFloat(content.lineHeight) / Number.parseFloat(content.fontSize),
        paddingRight: content.paddingRight,
        blockRatio: Number.parseFloat(block.paddingTop) / Number.parseFloat(block.fontSize),
      };
    });
    expect(spacing.ratio).toBeCloseTo(1.7, 2);
    expect(spacing.paddingRight).toBe("144px");
    expect(spacing.blockRatio).toBeCloseTo(0.35, 2);
    await test.info().attach("espaciado-editor", {
      body: await notes.locator(".editor-panel").screenshot(),
      contentType: "image/png",
    });
    await create.click();
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();
    await expect(editor).toHaveText("");
  } finally {
    await app.close();
  }
});
