import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  stubDialog,
  toolPage,
} from "./helpers.ts";

const toolDir = resolve(import.meta.dirname, "../../tools/md-converter");

test("el Convertidor cabe en la ventana mínima con su barra de iconos", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-converter-min-"));
  const longFile = join(userDataDir, `${"informe-trimestral-de-ventas-".repeat(3)}final.html`);
  await copyFile(join(toolDir, "tests/fixtures/sample.html"), longFile);
  const app = await launchApp({ userDataDir });
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath("md-converter")] });
    await shell.getByRole("button", { name: "Herramientas" }).click();
    await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
    await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
    const tool = await toolPage(app, "md-converter");
    const window = await app.browserWindow(shell);
    await window.evaluate((browserWindow) => browserWindow.setContentSize(760, 520));
    await stubDialog(app, "open", {
      canceled: false,
      filePaths: [join(toolDir, "tests/fixtures/sample.csv"), longFile],
    });
    await tool.getByRole("button", { name: "Elegir archivos…" }).click();
    const queue = tool.getByRole("list", { name: "Cola de conversión" });
    await expect(queue.getByRole("img", { name: "Listo" })).toHaveCount(2);
    await tool.getByRole("button", { name: "Borrar historial" }).focus();
    await tool.keyboard.press("Tab");
    await tool.keyboard.press("Tab");
    const longName = queue.getByRole("button", { name: longFile.split("/").at(-1), exact: true });
    await expect(longName).toBeFocused();
    await expect
      .poll(() =>
        longName.locator(".queue-filename").evaluate((node) => {
          const copy = node.querySelector(".queue-filename-copy");
          return (
            !!copy &&
            copy.getBoundingClientRect().height > 28 &&
            node.scrollWidth <= node.clientWidth + 1
          );
        }),
      )
      .toBe(true);

    // Cada acción de la barra es un icono con su nombre.
    for (const name of ["Vista renderizada", "Markdown crudo"]) {
      await expect(tool.getByRole("tab", { name, exact: true })).toBeVisible();
    }
    for (const name of ["Copiar", "Guardar .md", "Guardar todos…"]) {
      await expect(tool.getByRole("button", { name, exact: true })).toBeVisible();
    }
    await expect(tool.getByRole("button", { name: "Borrar historial" })).toBeVisible();

    await expect
      .poll(() =>
        tool.evaluate(() => {
          const toolbar = document.querySelector(".preview-toolbar");
          return (
            document.documentElement.scrollWidth <= innerWidth &&
            !!toolbar &&
            toolbar.scrollWidth <= toolbar.clientWidth &&
            [...toolbar.querySelectorAll("button")].every(
              (button) => button.getBoundingClientRect().right <= innerWidth,
            )
          );
        }),
      )
      .toBe(true);
    const panel = await tool.locator(".queue-panel").boundingBox();
    expect(Math.round(panel?.width ?? 0)).toBe(216);
    await tool.screenshot({ path: test.info().outputPath("convertidor-min.png") });
    await tool.keyboard.press("Enter");
    await expect(longName).toHaveAttribute("aria-current", "true");
    await tool.screenshot({ path: test.info().outputPath("nombre-largo-seleccionado.png") });
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});

for (const [width, reduced] of [
  [760, false],
  [760, true],
  [1280, false],
  [1280, true],
] as const) {
  test(`cancelación por puntero conserva el primer clic a ${width}, reducir movimiento ${reduced}`, async () => {
    const profile = await mkdtemp(join(tmpdir(), "lensdesk-converter-pointer-"));
    const app = await launchApp({ userDataDir: profile });
    const long = "documentacion-del-informe-".repeat(5);
    const names = [
      `${long}anchor.html`,
      "compact-short.html",
      `${long}compact-long.html`,
      "below-short.html",
      `${long}below-long.html`,
      "switch-short.html",
      `${long}switch-long.html`,
    ];
    try {
      const shell = await app.firstWindow();
      await enableDeveloperMode(shell);
      await installTool(app, shell, lenspkgPath("md-converter"), "Convertidor");
      await app.evaluate(({ ipcMain }, names) => {
        const original = (
          ipcMain as unknown as {
            _invokeHandlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
          }
        )._invokeHandlers.get("lensdesk:tool-invoke");
        if (!original) throw new Error("Falta el receptor de herramientas");
        const pending = new Map<
          string,
          { event: Electron.IpcMainInvokeEvent; resolve: (value: unknown) => void }
        >();
        ipcMain.removeHandler("lensdesk:tool-invoke");
        ipcMain.handle("lensdesk:tool-invoke", (event, channel, payload) => {
          if (channel === "files.pickOpen")
            return {
              ok: true,
              data: names.map((name, i) => ({ token: `pointer-${i}`, name, size: 1 })),
            };
          if (channel === "backend.invoke" && payload.method === "convert")
            return new Promise((resolve) => pending.set(payload.requestId, { event, resolve }));
          return original(event, channel, payload);
        });
      }, names);
      await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
      const tool = await toolPage(app, "md-converter");
      await (await app.browserWindow(shell)).evaluate(
        (window, width) => window.setContentSize(width, 520),
        width,
      );
      await tool.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
      await tool.getByRole("button", { name: "Elegir archivos…", exact: true }).click();
      const rows = tool.locator(".fila-conversion");
      await expect(rows).toHaveCount(names.length);
      await tool.evaluate(() => {
        const events: { event: string; label: string | null; x: number; y: number }[] = [];
        (window as typeof window & { cancellationEvents: typeof events }).cancellationEvents =
          events;
        for (const event of ["pointerdown", "pointerup"])
          document.addEventListener(
            event,
            (event) => {
              if (!(event.target instanceof Element)) return;
              const button = event.target.closest("button[aria-label^='Cancelar ']");
              if (!button) return;
              const rect = button.getBoundingClientRect();
              events.push({
                event: event.type,
                label: button.getAttribute("aria-label"),
                x: rect.x,
                y: rect.y,
              });
            },
            true,
          );
      });
      const cancel = async (index: number) => {
        const label = `Cancelar conversión de ${names[index]}`;
        await tool.getByRole("button", { name: label, exact: true }).click();
        await expect(rows.nth(index)).toHaveAccessibleName(`${names[index]}, Cancelado`);
        const events = await tool.evaluate(() =>
          (
            window as typeof window & {
              cancellationEvents: { event: string; label: string | null; x: number; y: number }[];
            }
          ).cancellationEvents.slice(-2),
        );
        expect(events.map((event) => event.event)).toEqual(["pointerdown", "pointerup"]);
        expect(events.map((event) => event.label)).toEqual([label, label]);
        expect(events[1]?.x).toBe(events[0]?.x);
        expect(events[1]?.y).toBe(events[0]?.y);
      };
      const keyboardFocusRow = async (index: number) => {
        await tool.getByRole("button", { name: "Borrar historial", exact: true }).focus();
        for (let step = 0; step < names.length * 2; step++) {
          await tool.keyboard.press("Tab");
          if (await rows.nth(index).evaluate((row) => row === document.activeElement)) break;
        }
        await expect(rows.nth(index)).toBeFocused();
      };
      // Primera interacción con estas filas: el puntero no cambia su distribución.
      await cancel(1);
      await cancel(2);
      await keyboardFocusRow(0);
      const expandedHeight = await rows
        .first()
        .evaluate((row) => row.getBoundingClientRect().height);
      // Cambiar de fila no contrae la que está encima del botón que se pulsa.
      await cancel(3);
      expect(await rows.first().evaluate((row) => row.getBoundingClientRect().height)).toBe(
        expandedHeight,
      );
      await cancel(4);
      expect(await rows.first().evaluate((row) => row.getBoundingClientRect().height)).toBe(
        expandedHeight,
      );
      // La misma fila conserva su distribución al pasar de teclado a puntero.
      for (const index of [5, 6]) {
        await keyboardFocusRow(index);
        await cancel(index);
      }
      await writeFile(
        test.info().outputPath("cancel-pointer-events.json"),
        JSON.stringify(
          await tool.evaluate(
            () => (window as typeof window & { cancellationEvents: unknown[] }).cancellationEvents,
          ),
          null,
          2,
        ),
      );
    } finally {
      await app.close().catch(() => undefined);
      await rm(profile, { recursive: true, force: true });
    }
  });
}

test("nombres completos por teclado en filas sin selección y con reducir movimiento", async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-converter-names-"));
  const app = await launchApp({ userDataDir });
  const names = ["error", "convirtiendo", "pendiente"].map(
    (state) => `${state}-${"informe-de-documentacion-".repeat(5)}final.html`,
  );
  try {
    const shell = await app.firstWindow();
    await enableDeveloperMode(shell);
    await installTool(app, shell, lenspkgPath("md-converter"), "Convertidor");
    await app.evaluate(({ ipcMain }, names) => {
      const handlers = (
        ipcMain as unknown as {
          _invokeHandlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
        }
      )._invokeHandlers;
      const original = handlers.get("lensdesk:tool-invoke");
      if (!original) throw new Error("Falta el receptor de herramientas");
      const pending = new Map<
        string,
        { event: Electron.IpcMainInvokeEvent; resolve: (value: unknown) => void }
      >();
      ipcMain.removeHandler("lensdesk:tool-invoke");
      ipcMain.handle("lensdesk:tool-invoke", async (event, channel, payload) => {
        if (channel === "files.pickOpen")
          return {
            ok: true,
            data: names.map((name, i) => ({ token: `sample-${i}`, name, size: 1 })),
          };
        if (channel === "backend.invoke" && payload.method === "convert") {
          if (payload.params.token === "sample-0")
            return { ok: false, error: { code: "E_INTERNAL", message: "Synthetic failure" } };
          return new Promise((resolve) => pending.set(payload.requestId, { event, resolve }));
        }
        return original(event, channel, payload);
      });
    }, names);
    await shell.getByRole("button", { name: "Abrir Convertidor", exact: true }).click();
    const tool = await toolPage(app, "md-converter");
    await tool.getByRole("button", { name: "Elegir archivos…", exact: true }).click();
    const rows = tool.locator(".fila-conversion");
    await expect(rows).toHaveCount(3);
    await expect(rows.first().locator(".queue-error")).toBeVisible();
    for (const [theme, accent, zoom, reduced] of [
      ["light", "blue", 1, false],
      ["dark", "green", 1, true],
      ["light", "green", 2, true],
      ["dark", "blue", 2, false],
    ] as const) {
      await shell.evaluate(
        async ({ theme, accent }) => {
          await window.lensdeskHost.invoke("settings.set", { key: "theme", value: theme });
          await window.lensdeskHost.invoke("settings.set", { key: "accent", value: accent });
        },
        { theme, accent },
      );
      await (await app.browserWindow(shell)).evaluate((window) => window.setContentSize(760, 520));
      await app.evaluate(({ webContents }, zoom) => {
        webContents
          .getAllWebContents()
          .find((view) => view.getURL().startsWith("lenstool://md-converter/"))
          ?.setZoomFactor(zoom);
      }, zoom);
      await expect.poll(() => tool.evaluate(() => innerWidth)).toBe(760 / zoom);
      await tool.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
      for (let i = 0; i < names.length; i++) {
        const row = rows.nth(i);
        await tool.getByRole("button", { name: "Borrar historial" }).focus();
        for (let step = 0; step < (i === 0 ? 1 : i === 1 ? 2 : 4); step++)
          await tool.keyboard.press("Tab");
        await expect(row).toBeFocused();
        await expect(row).toHaveAccessibleName(
          `${names[i]}, ${["Error", "Convirtiendo…", "En cola"][i]}`,
        );
        await expect(row.locator(".queue-card > button")).toBeDisabled();
        const layout = await row.evaluate((element) => {
          const card = element.querySelector<HTMLElement>(".queue-card");
          const name = element.querySelector<HTMLElement>(".queue-filename");
          const actions = element.querySelector<HTMLElement>(".queue-card > .col-start-2");
          if (!card || !name || !actions) throw new Error("Falta la fila del archivo");
          const style = getComputedStyle(card);
          return {
            innerWidth:
              card.clientWidth -
              Number.parseFloat(style.paddingLeft) -
              Number.parseFloat(style.paddingRight),
            name: name.getBoundingClientRect().toJSON(),
            actions: actions.getBoundingClientRect().toJSON(),
            card: card.getBoundingClientRect().toJSON(),
          };
        });
        await writeFile(
          test.info().outputPath(`layout-${i}-${theme}-${accent}-${zoom}.json`),
          JSON.stringify(layout, null, 2),
        );
        expect(Math.abs(layout.name.width - layout.innerWidth)).toBeLessThanOrEqual(1);
        expect(layout.actions.top).toBeGreaterThanOrEqual(layout.name.bottom - 1);
        await writeFile(
          test.info().outputPath(`geometry-${i}-${theme}-${accent}-${zoom}.json`),
          JSON.stringify(
            await row.evaluate((element) => ({
              viewport: [innerWidth, innerHeight],
              row: element.getBoundingClientRect().toJSON(),
              containers: [".queue-list", ".queue-panel"].map((selector) => {
                const node = document.querySelector(selector) as HTMLElement;
                return {
                  selector,
                  clientHeight: node.clientHeight,
                  scrollHeight: node.scrollHeight,
                  scrollTop: node.scrollTop,
                  rect: node.getBoundingClientRect().toJSON(),
                };
              }),
            })),
            null,
            2,
          ),
        );
        expect(
          await tool.locator(".queue-list").evaluate((element) => element.clientHeight),
        ).toBeGreaterThan(0);
        await expect
          .poll(() =>
            row.locator(".queue-filename").evaluate((node) => {
              const copy = node.querySelector(".queue-filename-copy");
              const bounds = node.getBoundingClientRect();
              return (
                !!copy &&
                copy.getBoundingClientRect().height > 28 &&
                node.scrollWidth <= node.clientWidth + 1 &&
                bounds.right <= innerWidth
              );
            }),
          )
          .toBe(true);
        await tool.keyboard.press("Enter");
        await tool.keyboard.press("Space");
        await expect(row).toBeFocused();
        const settleScroll = () =>
          row.evaluate(
            (element) =>
              new Promise<void>((resolve) => {
                let previous = "";
                let stable = 0;
                const frame = () => {
                  const offsets = [];
                  for (let parent: Element | null = element; parent; parent = parent.parentElement)
                    offsets.push(parent.scrollTop, parent.scrollLeft);
                  const current = offsets.join(",");
                  stable = current === previous ? stable + 1 : 0;
                  previous = current;
                  if (stable >= 3) resolve();
                  else requestAnimationFrame(frame);
                };
                requestAnimationFrame(frame);
              }),
          );
        await settleScroll();
        for (const edge of ["start", "end"] as const) {
          const visibility = () =>
            row.locator(".queue-filename-copy").evaluate((element, edge) => {
              const text = element.firstChild;
              if (!text?.textContent) throw new Error("Falta el nombre");
              const range = document.createRange();
              const offset = edge === "start" ? 0 : text.textContent.length - 1;
              range.setStart(text, offset);
              range.setEnd(text, offset + 1);
              const rect = range.getBoundingClientRect();
              let top = 0;
              let bottom = innerHeight;
              for (let parent = element.parentElement; parent; parent = parent.parentElement) {
                if (getComputedStyle(parent).overflowY !== "visible") {
                  const bounds = parent.getBoundingClientRect();
                  top = Math.max(top, bounds.top);
                  bottom = Math.min(bottom, bounds.bottom);
                }
              }
              return {
                visible: rect.top >= top - 0.5 && rect.bottom <= bottom + 0.5,
                above: rect.top < top,
              };
            }, edge);
          for (let step = 0; step < 40; step++) {
            const current = await visibility();
            if (current.visible) break;
            await tool.keyboard.press(current.above ? "ArrowUp" : "ArrowDown");
            await settleScroll();
          }
          expect((await visibility()).visible).toBe(true);
          await expect(row).toBeFocused();
          expect(
            await row
              .locator(".queue-filename-track")
              .evaluate((element) => element.getAnimations().length),
          ).toBe(0);
          const png = await app.evaluate(async ({ webContents }) => {
            const view = webContents
              .getAllWebContents()
              .find((entry) => entry.getURL().startsWith("lenstool://md-converter/"));
            if (!view) throw new Error("No tool view");
            return (await view.capturePage()).toPNG().toString("base64");
          });
          await writeFile(
            test.info().outputPath(`name-${i}-${theme}-${accent}-${zoom}-${reduced}-${edge}.png`),
            Buffer.from(png, "base64"),
          );
        }
      }
      await expect
        .poll(() => tool.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true });
  }
});
