import { writeFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import {
  enableDeveloperMode,
  launchApp,
  lenspkgPath,
  shellPage,
  stubDialog,
  toolPage,
} from "./helpers.ts";

async function captureNoteInput(page: Page) {
  await page.evaluate(() => {
    const events: unknown[] = [];
    (window as typeof window & { focusLog: unknown[] }).focusLog = events;
    for (const event of ["focusin", "focusout", "beforeinput", "input"])
      document.addEventListener(
        event,
        (event) => {
          const title = document.querySelector<HTMLInputElement>(".note-title input");
          const body = document.querySelector<HTMLElement>(".cm-content");
          events.push({
            time: performance.now(),
            event: event.type,
            target: (event.target as Element).getAttribute("aria-label"),
            active: document.activeElement?.getAttribute("aria-label"),
            title: title?.value,
            readonly: title?.readOnly,
            body: body?.textContent,
          });
        },
        true,
      );
  });
}

test("el título inicial conserva el foco sin contorno y los botones muestran mano", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    const heading = shell.getByRole("heading", { name: "Herramientas", exact: true });
    await expect(heading).toBeFocused();
    await expect(heading).toHaveCSS("outline-style", "none");
    const button = shell.getByRole("button", { name: "Agregar herramienta…" });
    await expect(button).toHaveCSS("cursor", "pointer");
    await shell.keyboard.press("Tab");
    await expect(shell.locator(":focus-visible")).toHaveCSS("outline-style", "solid");
  } finally {
    await app.close();
  }
});

test("el título no se selecciona y la vista previa de Notas sí", async () => {
  const app = await launchApp();
  try {
    const shell = await shellPage(app);
    await shell
      .getByRole("heading", { name: "Herramientas", exact: true })
      .click({ clickCount: 3 });
    expect(await shell.evaluate(() => window.getSelection()?.toString())).toBe("");
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("notes")] });
    await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const notes = await toolPage(app, "notes");
    await captureNoteInput(notes);
    await notes.getByRole("button", { name: "Nueva nota" }).first().click();
    await notes.locator(".cm-content").fill("# Texto seleccionable\nContenido para copiar");
    await writeFile(
      test.info().outputPath("fill-focus.json"),
      JSON.stringify(
        await notes.evaluate(() => (window as typeof window & { focusLog: unknown[] }).focusLog),
        null,
        2,
      ),
    );
    await notes.getByRole("radio", { name: "Ver", exact: true }).click();
    const preview = notes
      .locator(".ld-markdown-view")
      .getByRole("heading", { name: "Texto seleccionable" });
    await expect(preview).toBeVisible();
    await notes.evaluate(() => window.getSelection()?.removeAllRanges());
    await preview.click({ clickCount: 3 });
    expect(await notes.evaluate(() => window.getSelection()?.toString())).toContain(
      "Texto seleccionable",
    );
  } finally {
    await app.close();
  }
});

test("escribir en el cuerpo conserva el foco mientras se guarda el título", async () => {
  const app = await launchApp();
  let notes: Page | undefined;
  let failed = false;
  let failure: unknown;
  try {
    const shell = await shellPage(app);
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("notes")] });
    await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…", exact: true }).click();
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    notes = await toolPage(app, "notes");
    await captureNoteInput(notes);
    await app.evaluate(({ ipcMain }) => {
      const handlers = (
        ipcMain as unknown as {
          _invokeHandlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
        }
      )._invokeHandlers;
      const original = handlers.get("lensdesk:tool-invoke");
      if (!original) throw new Error("Falta el receptor de herramientas");
      const pending: (() => void)[] = [];
      (globalThis as typeof globalThis & { releaseTitle: () => void }).releaseTitle = () =>
        pending.splice(0).forEach((release) => {
          release();
        });
      ipcMain.removeHandler("lensdesk:tool-invoke");
      ipcMain.handle("lensdesk:tool-invoke", async (event, channel, payload) => {
        const result = await original(event, channel, payload);
        if (channel === "backend.invoke" && payload?.method === "rename")
          await new Promise<void>((resolve) => pending.push(resolve));
        return result;
      });
    });
    await notes.getByRole("button", { name: "Nueva nota", exact: true }).first().click();
    const title = notes.getByRole("textbox", { name: "Título de la nota", exact: true });
    await expect(title).toBeFocused();
    await title.fill("Nombre conservado");
    const body = notes.locator(".cm-content");
    await body.click();
    await expect(title).toHaveAttribute("readonly");
    await expect(body).toBeFocused();
    await notes.keyboard.type("# Entrada de teclado");
    await notes.keyboard.press("Enter");
    await notes.keyboard.type("Contenido conservado.");
    await expect(body.locator(".cm-line")).toHaveText([
      "# Entrada de teclado",
      "Contenido conservado.",
    ]);
    await expect(body).toBeFocused();
    await app.evaluate(() =>
      (globalThis as typeof globalThis & { releaseTitle: () => void }).releaseTitle(),
    );
    await expect(
      notes.getByRole("heading", { name: "Nombre conservado", exact: true }),
    ).toBeVisible();
    await expect(body).toBeFocused();
    await notes.getByRole("radio", { name: "Ver", exact: true }).click();
    await expect(
      notes
        .locator(".ld-markdown-view")
        .getByRole("heading", { name: "Entrada de teclado", exact: true }),
    ).toBeVisible();
    await expect(notes.locator(".ld-markdown-view")).toContainText("Contenido conservado.");
    await notes.screenshot({ path: test.info().outputPath("title-body-preview.png") });
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    try {
      await app.evaluate(() =>
        (globalThis as typeof globalThis & { releaseTitle?: () => void }).releaseTitle?.(),
      );
      if (notes)
        await writeFile(
          test.info().outputPath("keyboard-focus.json"),
          JSON.stringify(
            await notes.evaluate(
              () => (window as typeof window & { focusLog: unknown[] }).focusLog,
            ),
            null,
            2,
          ),
        );
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    } finally {
      try {
        await app.close();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
  }
  if (failed) throw failure;
});
