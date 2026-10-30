import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  stubDialog,
  toolPage,
} from "./helpers.ts";

const longWord = "documentacion".repeat(24);
const documentHtml = `<h1>Lectura compartida</h1><p>Documento sintético para comparar lectura, enlaces y contenido ancho.</p><h2>Contenido</h2><p><a href="https://example.test/${longWord}">https://example.test/${longWord}</a></p><ul><li>Primer elemento</li><li>Segundo elemento</li></ul><blockquote>Una cita que conserva su significado.</blockquote><pre><code>const ejemplo = "${longWord}";</code></pre><table><thead><tr>${Array.from({ length: 8 }, (_, i) => `<th>Columna ${i + 1}</th>`).join("")}</tr></thead><tbody><tr>${Array.from({ length: 8 }, () => "<td>Contenido comparable de la tabla</td>").join("")}</tr></tbody></table>`;

test("lectura compartida sin desborde a 200%", async () => {
  const profile = await mkdtemp(join(tmpdir(), "lensdesk-reading-"));
  const app = await launchApp({ userDataDir: profile });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("md-converter")] });
    await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…", exact: true }).click();
    await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
    const tool = await toolPage(app, "md-converter");
    const input = join(profile, "lectura.html");
    await writeFile(input, documentHtml);
    await stubDialog(app, "open", { canceled: false, filePaths: [input] });
    await tool.getByRole("button", { name: "Elegir archivos…", exact: true }).click();
    await expect(tool.locator(".ld-markdown-view h1")).toHaveText("Lectura compartida");
    await tool.getByRole("tab", { name: "Markdown crudo", exact: true }).click();
    const markdown = await tool.locator(".raw-markdown").innerText();
    await tool.getByRole("tab", { name: "Vista renderizada", exact: true }).click();
    for (const [width, height, zoom, theme, accent] of [
      [1100, 800, 2, "light", "blue"],
      [760, 520, 2, "dark", "green"],
      [1280, 900, 1, "light", "green"],
      [1280, 900, 1, "dark", "blue"],
    ] as const) {
      await shell.evaluate(
        async ({ theme, accent }) => {
          await window.lensdeskHost.invoke("settings.set", { key: "theme", value: theme });
          await window.lensdeskHost.invoke("settings.set", { key: "accent", value: accent });
        },
        { theme, accent },
      );
      await (await app.browserWindow(shell)).evaluate(
        (window, size) => window.setContentSize(...size),
        [width, height] as [number, number],
      );
      await app.evaluate(({ webContents }, zoom) => {
        webContents
          .getAllWebContents()
          .find((view) => view.getURL().startsWith("lenstool://md-converter/"))
          ?.setZoomFactor(zoom);
      }, zoom);
      await expect.poll(() => tool.evaluate(() => innerWidth)).toBe(width / zoom);
      await captureReading("md-converter", `${theme}-${accent}-${zoom}`);
      for (const button of [
        tool.getByRole("button", { name: "Elegir archivos…", exact: true }),
        tool.getByRole("button", { name: "Copiar", exact: true }),
      ]) {
        await button.focus();
        await expect(button).toBeFocused();
        const focusGeometry = await button.evaluate((element) => {
          if (!(element instanceof HTMLElement)) throw new Error("Expected HTML button");
          const boxes = [];
          for (let node: HTMLElement | null = element; node; node = node.parentElement) {
            boxes.push({
              tag: node.tagName,
              class: node.className,
              rect: node.getBoundingClientRect().toJSON(),
              scrollTop: node.scrollTop,
              clientHeight: node.clientHeight,
              scrollHeight: node.scrollHeight,
              overflow: getComputedStyle(node).overflow,
              transform: getComputedStyle(node).transform,
            });
          }
          return { viewport: [innerWidth, innerHeight], boxes };
        });

        await writeFile(
          test
            .info()
            .outputPath(
              `focus-${theme}-${accent}-${(await button.getAttribute("aria-label")) || "choose"}.json`,
            ),
          JSON.stringify(focusGeometry, null, 2),
        );
        await captureReading("md-converter", `focus-${theme}-${accent}`);
        await expect(button).toBeInViewport({ ratio: 1 });
      }
    }
    await installTool(app, shell, lenspkgPath("notes"), "Notas");
    await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
    const notes = await toolPage(app, "notes");
    await notes.getByRole("button", { name: "Nueva nota", exact: true }).first().click();
    await notes.getByRole("textbox", { name: "Título de la nota" }).fill("Lectura compartida");
    await notes.getByRole("textbox", { name: "Título de la nota" }).press("Enter");
    await notes.locator(".cm-content").fill(markdown);
    await notes.getByRole("radio", { name: "Ver", exact: true }).click();
    await expect(notes.locator(".ld-markdown-view h1")).toHaveText("Lectura compartida");
    for (const [theme, accent] of [
      ["light", "blue"],
      ["light", "green"],
      ["dark", "blue"],
      ["dark", "green"],
    ] as const) {
      await shell.evaluate(
        async ({ theme, accent }) => {
          await window.lensdeskHost.invoke("settings.set", { key: "theme", value: theme });
          await window.lensdeskHost.invoke("settings.set", { key: "accent", value: accent });
        },
        { theme, accent },
      );
      await expect(notes.locator("html")).toHaveAttribute("data-theme", theme);
      await expect
        .poll(() => notes.locator("html").getAttribute("data-accent"))
        .toBe(accent === "green" ? "green" : null);
      await notes.getByRole("radio", { name: "Editar", exact: true }).click();
      await notes
        .locator(".cm-content")
        .fill("```js\nconst fenced = 1;\n```\n\n    const indented = 2;");
      await expect(notes.locator(".cm-md-code")).toHaveCount(4);
      const editorColors = await notes
        .locator(".cm-md-code, .cm-md-code span")
        .evaluateAll((nodes) => ({
          colors: nodes.map((node) => getComputedStyle(node).color),
          code: getComputedStyle(document.documentElement).getPropertyValue("--ld-code").trim(),
        }));
      for (const color of editorColors.colors) expect(color).toBe(rgb(editorColors.code));
      await writeFile(
        test.info().outputPath(`editor-${theme}-${accent}.json`),
        JSON.stringify(editorColors, null, 2),
      );
      await notes.locator(".cm-content").fill(markdown);
      await notes.getByRole("radio", { name: "Ver", exact: true }).click();
      await notes.getByRole("button", { name: "Copiar código", exact: true }).click();
      const confirmation = notes.locator(".ld-code-header button.copy-confirmation");
      await expect(confirmation).toBeVisible();
      const success = await confirmation.evaluate((button) => ({
        color: getComputedStyle(button).color,
        token: getComputedStyle(document.documentElement).getPropertyValue("--ld-success").trim(),
      }));
      expect(success.color).toBe(rgb(success.token));
      const card = notes.getByRole("button", { name: "Lectura compartida", exact: true });
      await card.hover();
      await captureReading("notes", `${theme}-${accent}-hover`);
      await notes.mouse.down();
      await captureReading("notes", `${theme}-${accent}-pressed`);
      await notes.mouse.up();
      await card.focus();
      await notes.keyboard.press("Tab");
      await notes.keyboard.press("Shift+Tab");
      await expect(card).toBeFocused();
      await expect(card).toHaveAttribute("aria-current", "true");
      await captureReading("notes", `${theme}-${accent}-focus`);
    }
    await captureReading("notes", "wide");
    await (await app.browserWindow(shell)).evaluate((window) => window.setContentSize(760, 520));
    await app.evaluate(({ webContents }) => {
      webContents
        .getAllWebContents()
        .find((view) => view.getURL().startsWith("lenstool://notes/"))
        ?.setZoomFactor(2);
    });
    await expect.poll(() => notes.evaluate(() => innerWidth)).toBe(380);
    await captureReading("notes", "minimum-200");

    async function captureReading(id: string, state: string) {
      const page = await toolPage(app, id);
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await Promise.all(
          document
            .getAnimations()
            .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
            .map((animation) => animation.finished.catch(() => undefined)),
        );
      });
      const geometry = await page.evaluate(() => {
        const article = document.querySelector<HTMLElement>(".ld-markdown-view");
        if (!article) throw new Error("Missing reading article");
        const style = getComputedStyle(article);
        return {
          viewport: innerWidth,
          document: document.documentElement.scrollWidth,
          article: article.getBoundingClientRect().toJSON(),
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          codeToken: getComputedStyle(document.documentElement)
            .getPropertyValue("--ld-code")
            .trim(),
          code: [...article.querySelectorAll("code")].map((node) => {
            const style = getComputedStyle(node);
            return { color: style.color, fontSize: style.fontSize, lineHeight: style.lineHeight };
          }),
          scrollables: [...article.querySelectorAll("pre, table")].map((element) => ({
            client: element.clientWidth,
            scroll: element.scrollWidth,
            rect: element.getBoundingClientRect().toJSON(),
          })),
        };
      });
      await writeFile(
        test.info().outputPath(`${id}-${state}.json`),
        JSON.stringify(geometry, null, 2),
      );
      const png = await app.evaluate(async ({ webContents }, id) => {
        const view = webContents
          .getAllWebContents()
          .find((entry) => entry.getURL().startsWith(`lenstool://${id}/`));
        if (!view) throw new Error("No tool view");
        return (await view.capturePage()).toPNG().toString("base64");
      }, id);
      await writeFile(test.info().outputPath(`${id}-${state}.png`), Buffer.from(png, "base64"));
      expect(geometry.document).toBeLessThanOrEqual(geometry.viewport);
      expect(geometry.article.width).toBeLessThanOrEqual(640);
      expect(geometry.article.right).toBeLessThanOrEqual(geometry.viewport);
      expect(geometry.fontSize).toBe("15px");
      expect(geometry.lineHeight).toBe("25.5px");
      expect(geometry.code.length).toBeGreaterThan(0);
      for (const code of geometry.code) {
        expect(code.fontSize).toBe("13px");
        expect(code.lineHeight).toBe("18.85px");
        expect(code.color).toBe(rgb(geometry.codeToken));
      }
      expect(geometry.scrollables).toHaveLength(2);
      for (const area of geometry.scrollables)
        expect(area.rect.right).toBeLessThanOrEqual(geometry.viewport);
    }
  } finally {
    await app.close().catch(() => undefined);
    await rm(profile, { recursive: true, force: true });
  }
});

function rgb(hex: string) {
  return `rgb(${[1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(", ")})`;
}
