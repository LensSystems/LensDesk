import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  shellPage,
  toolPage,
} from "./helpers.ts";

const scenarios = [
  { width: 760, height: 520, zoom: 2, language: "es", theme: "light", accent: "blue" },
  { width: 900, height: 800, zoom: 1.25, language: "en", theme: "dark", accent: "green" },
  { width: 960, height: 800, zoom: 1.5, language: "es", theme: "light", accent: "green" },
  { width: 1100, height: 800, zoom: 2, language: "en", theme: "dark", accent: "blue" },
  { width: 1280, height: 800, zoom: 1, language: "es", theme: "light", accent: "blue" },
];
for (const scenario of scenarios) {
  test(`diálogo largo ${scenario.width}/${scenario.zoom}/${scenario.language}/${scenario.theme}/${scenario.accent}`, async () => {
    const profile = await mkdtemp(join(tmpdir(), "lensdesk-dialog-layout-"));
    const app = await launchApp({ userDataDir: profile });
    try {
      const shell = await shellPage(app);
      await enableDeveloperMode(shell);
      await installTool(app, shell, lenspkgPath("notes"), "Notas");
      await shell.evaluate(async (scenario) => {
        for (const key of ["theme", "accent", "locale"] as const) {
          const result = await window.lensdeskHost.invoke("settings.set", {
            key,
            value: key === "locale" ? scenario.language : scenario[key],
          });
          if (!result.ok) throw new Error(`No se pudo configurar ${key}`);
        }
      }, scenario);
      const state = await shell.evaluate(async () => {
        const result = await window.lensdeskHost.invoke("tools.list", {});
        if (!result.ok) throw new Error("No se pudo leer el perfil sintético");
        return result.data;
      });
      const name = `Herramienta de referencia sintética con un nombre descriptivo largo ${"Referencia-".repeat(8)}`;
      for (const tool of state.tools) {
        const manifest = tool.manifest as { name: Record<string, string> };
        manifest.name = { es: name, en: name };
      }
      await app.evaluate(({ BrowserWindow }, state) => {
        BrowserWindow.getAllWindows()[0]?.webContents.send("tools.changed", state);
      }, state);
      const appWindow = await app.browserWindow(shell);
      await appWindow.evaluate(
        (browserWindow, size) => browserWindow.setContentSize(size.width, size.height),
        scenario,
      );
      await app.evaluate(
        ({ BrowserWindow }, zoom) =>
          BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(zoom),
        scenario.zoom,
      );
      const trigger = shell.getByRole("button", {
        name: new RegExp(`${scenario.language === "es" ? "Acciones de" : "Actions for"} ${name}`),
      });
      await trigger.click();
      await shell
        .getByRole("menuitem", {
          name: scenario.language === "es" ? "Quitar" : "Remove",
          exact: true,
        })
        .click();
      const dialog = shell.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await shell.screenshot({
        animations: "disabled",
        path: test.info().outputPath("dialogo-herramienta.png"),
      });
      await writeFile(
        test.info().outputPath("dialogo-herramienta-native.png"),
        Buffer.from(
          await appWindow.evaluate(async (browserWindow) =>
            (await browserWindow.capturePage()).toPNG().toString("base64"),
          ),
          "base64",
        ),
      );
      const geometry = await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const heading = element.querySelector("h2")?.getBoundingClientRect();
        return {
          viewport: { width: innerWidth, height: innerHeight },
          dialog: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom,
          },
          title: heading
            ? {
                x: heading.x,
                y: heading.y,
                width: heading.width,
                height: heading.height,
                right: heading.right,
                bottom: heading.bottom,
              }
            : null,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      await writeFile(test.info().outputPath("geometria.json"), JSON.stringify(geometry, null, 2));
      await expect(dialog).toBeInViewport({ ratio: 1 });
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport.width);
      for (let index = 0; index < 8; index++) {
        await shell.keyboard.press("Tab");
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
          true,
        );
        await writeFile(
          test.info().outputPath(`foco-${index}.json`),
          JSON.stringify(
            await dialog.evaluate((element) => {
              const focus = document.activeElement as HTMLElement;
              const rect = focus.getBoundingClientRect();
              return {
                tag: focus.tagName,
                id: focus.id,
                focus: rect.toJSON(),
                dialog: element.getBoundingClientRect().toJSON(),
                scrollTop: element.scrollTop,
                viewport: { width: innerWidth, height: innerHeight },
                visibility: getComputedStyle(focus).visibility,
                display: getComputedStyle(focus).display,
              };
            }),
            null,
            2,
          ),
        );
        const focused = shell.locator(":focus");
        await expect(focused).toBeInViewport({ ratio: 1 });
      }
      await shell.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await shell
        .getByRole("menuitem", {
          name: scenario.language === "es" ? "Ver detalles" : "View details",
          exact: true,
        })
        .click();
      await expect(dialog).toBeInViewport({ ratio: 1 });
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      for (let index = 0; index < 8; index++) {
        await shell.keyboard.press("Tab");
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
          true,
        );
        await expect(shell.locator(":focus")).toBeInViewport({ ratio: 1 });
      }
      await shell.screenshot({ path: test.info().outputPath("dialogo-detalles.png") });
      await writeFile(
        test.info().outputPath("dialogo-detalles-native.png"),
        Buffer.from(
          await appWindow.evaluate(async (browserWindow) =>
            (await browserWindow.capturePage()).toPNG().toString("base64"),
          ),
          "base64",
        ),
      );
      await dialog
        .getByLabel(scenario.language === "es" ? "Cerrar" : "Close", { exact: true })
        .click();
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    } finally {
      await app.close().catch(() => undefined);
      await rm(profile, { recursive: true, force: true });
    }
  });
}

for (const variant of [
  { theme: "light", accent: "blue", zoom: 1, width: 760, height: 520 },
  { theme: "light", accent: "green", zoom: 1.25, width: 900, height: 800 },
  { theme: "dark", accent: "blue", zoom: 1.5, width: 960, height: 800 },
  { theme: "dark", accent: "green", zoom: 2, width: 1100, height: 800 },
]) {
  test(`consumidores Notas ${variant.theme}/${variant.accent}/${variant.zoom}`, async () => {
    const profile = await mkdtemp(join(tmpdir(), "lensdesk-notes-dialog-"));
    const app = await launchApp({ userDataDir: profile });
    try {
      const shell = await shellPage(app);
      await enableDeveloperMode(shell);
      await installTool(app, shell, lenspkgPath("notes"), "Notas");
      await shell.evaluate(async ({ theme, accent }) => {
        await window.lensdeskHost.invoke("settings.set", { key: "theme", value: theme });
        await window.lensdeskHost.invoke("settings.set", { key: "accent", value: accent });
      }, variant);
      await shell.getByRole("button", { name: "Abrir Notas", exact: true }).click();
      const tool = await toolPage(app, "notes");
      const captureTool = async () =>
        app.evaluate(async ({ webContents }) => {
          const view = webContents
            .getAllWebContents()
            .find((item) => item.getURL().startsWith("lenstool://notes/"));
          if (!view) throw new Error("Falta la vista de Notas");
          return (await view.capturePage()).toPNG().toString("base64");
        });
      await tool.getByRole("button", { name: "Nueva nota", exact: true }).first().click();
      const title = tool.getByRole("textbox", { name: "Título de la nota" });
      await title.fill("Título sintético largo ".repeat(12));
      await title.press("Enter");
      const appWindow = await app.browserWindow(shell);
      await appWindow.evaluate(
        (browserWindow, size) => browserWindow.setContentSize(size.width, size.height),
        variant,
      );
      await app.evaluate(({ webContents }, zoom) => {
        webContents
          .getAllWebContents()
          .find((view) => view.getURL().startsWith("lenstool://notes/"))
          ?.setZoomFactor(zoom);
      }, variant.zoom);
      const dialog = tool.getByRole("dialog");
      const checkDialog = async (label: string) => {
        await expect(dialog).toBeVisible();
        await expect
          .poll(() =>
            tool.evaluate(() =>
              document.getAnimations().every((animation) => animation.playState !== "running"),
            ),
          )
          .toBe(true);
        await writeFile(
          test.info().outputPath(`${label}-geometry.json`),
          JSON.stringify(
            await dialog.evaluate((element) => ({
              viewport: { width: innerWidth, height: innerHeight },
              rect: element.getBoundingClientRect().toJSON(),
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
              overflowing: [...element.querySelectorAll("*")]
                .filter(
                  (child) =>
                    child.getBoundingClientRect().right > element.getBoundingClientRect().right,
                )
                .map((child) => ({
                  tag: child.tagName,
                  classes: child.className,
                  rect: child.getBoundingClientRect().toJSON(),
                })),
            })),
            null,
            2,
          ),
        );
        await tool.screenshot({ path: test.info().outputPath(`${label}-initial.png`) });
        await expect(dialog).toBeInViewport({ ratio: 1 });
        expect(await tool.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
          true,
        );
        for (let i = 0; i < 16; i++) {
          await tool.keyboard.press("Tab");
          expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
            true,
          );
          await expect(tool.locator(":focus")).toBeInViewport({ ratio: 1 });
        }
        await tool.screenshot({ path: test.info().outputPath(`${label}.png`) });
        await writeFile(
          test.info().outputPath(`${label}-native.png`),
          Buffer.from(await captureTool(), "base64"),
        );
      };
      const sidebarTrigger = tool.getByRole("button", { name: "Mostrar lista de notas" });
      await sidebarTrigger.click();
      await checkDialog("sidebar");
      await tool.keyboard.press("Escape");
      await expect(sidebarTrigger).toBeFocused();
      const lock = tool.getByRole("button", { name: "Hacer privada", exact: true });
      await lock.click();
      await checkDialog("vault-notice");
      await tool.keyboard.press("Escape");
      await expect(lock).toBeFocused();
      await lock.click();
      await dialog.getByRole("button", { name: "Crear contraseña", exact: true }).click();
      await checkDialog("vault-setup");
      await dialog.getByLabel("Contraseña", { exact: true }).fill("Abcd1!");
      await dialog.getByLabel("Confirmar contraseña", { exact: true }).fill("Abcd1!");
      await dialog.getByLabel("Respuesta 1").fill("Lima");
      await dialog.getByLabel("Respuesta 2").fill("Gato");
      await dialog.getByRole("button", { name: "Guardar y bloquear", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(tool.getByRole("heading", { name: "Esta nota es privada" })).toBeVisible();
      await tool.getByLabel("Contraseña", { exact: true }).fill("Abcd1!");
      await tool.getByRole("button", { name: "Desbloquear", exact: true }).click();
      const editor = tool.locator(".cm-content");
      await editor.click({ button: "right" });
      await tool.getByRole("menuitem", { name: "Insertar", exact: true }).click();
      const submenu = tool.getByRole("menu", { name: "Insertar", exact: true });
      await expect(submenu).toHaveAttribute("data-state", "open");
      await expect(submenu).toBeVisible();
      await expect(submenu).toBeInViewport({ ratio: 1 });
      await expect
        .poll(() =>
          submenu.evaluate(async (element) => {
            const before = element.getBoundingClientRect();
            const viewport = { width: innerWidth, height: innerHeight };
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            );
            const after = element.getBoundingClientRect();
            return (
              element.isConnected &&
              element.getAttribute("data-state") === "open" &&
              element
                .getAnimations({ subtree: true })
                .every((animation) => !animation.pending && animation.playState !== "running") &&
              viewport.width === innerWidth &&
              viewport.height === innerHeight &&
              ["x", "y", "width", "height"].every(
                (key) =>
                  Math.abs(
                    (before[key as keyof DOMRect] as number) -
                      (after[key as keyof DOMRect] as number),
                  ) < 0.5,
              ) &&
              after.width > 0 &&
              after.height > 0 &&
              after.left >= 0 &&
              after.top >= 0 &&
              after.right <= innerWidth &&
              after.bottom <= innerHeight
            );
          }),
        )
        .toBe(true);
      if (variant.zoom === 2) {
        await expect(submenu).toBeInViewport({ ratio: 1 });
        await submenu.hover();
        await tool.mouse.wheel(0, 600);
        await expect(tool.getByRole("menuitem", { name: "Contraseña…" })).toBeInViewport({
          ratio: 1,
        });
        await expect
          .poll(() =>
            tool.evaluate(() =>
              document.getAnimations().every((animation) => animation.playState !== "running"),
            ),
          )
          .toBe(true);
        await writeFile(
          test.info().outputPath("context-submenu-geometry.json"),
          JSON.stringify(
            await tool.evaluate(() => ({
              viewport: { width: innerWidth, height: innerHeight },
              dialogs: document.querySelectorAll('[role="dialog"]').length,
              menus: [...document.querySelectorAll('[role="menu"], [role="menuitem"]')].map(
                (element) => ({
                  name: element.getAttribute("aria-label") ?? element.textContent,
                  rect: element.getBoundingClientRect().toJSON(),
                  clientHeight: element.clientHeight,
                  scrollHeight: element.scrollHeight,
                  overflowY: getComputedStyle(element).overflowY,
                }),
              ),
            })),
            null,
            2,
          ),
        );
        await writeFile(
          test.info().outputPath("context-submenu-native.png"),
          Buffer.from(await captureTool(), "base64"),
        );
        await expect(tool.getByRole("menuitem", { name: "Contraseña…" })).toBeInViewport({
          ratio: 1,
        });
      }
      await tool.getByRole("menuitem", { name: "Contraseña…" }).click();
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Usuario", { exact: true }).fill("sintetico-".repeat(30));
      await dialog
        .getByLabel("Notas", { exact: true })
        .fill("Texto sintético de referencia ".repeat(30));
      await dialog.getByRole("button", { name: "Añadir campo", exact: true }).click();
      const menu = tool.getByRole("menu");
      await expect(menu).toBeInViewport({ ratio: 1 });
      await tool.getByRole("menuitem", { name: "Texto simple", exact: true }).click();
      await expect(dialog.getByLabel("Nombre del campo", { exact: true })).toBeFocused();
      await dialog
        .getByLabel("Nombre del campo", { exact: true })
        .fill("Campo sintético ".repeat(15));
      await checkDialog("credential");
      await tool.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(editor).toBeFocused();
      await writeFile(
        test.info().outputPath("credential-return-focus.json"),
        JSON.stringify(
          await tool.evaluate(() => ({
            tag: document.activeElement?.tagName,
            classes: document.activeElement?.className,
          })),
          null,
          2,
        ),
      );
      const openCredentialWithKeyboard = async (attempt: string) => {
        await editor.press("Shift+F10");
        const rootMenu = tool.getByRole("menu", { name: "Menú de edición", exact: true });
        await expect(rootMenu).toBeVisible();
        await expect
          .poll(() => rootMenu.evaluate((element) => element.contains(document.activeElement)))
          .toBe(true);
        await tool.keyboard.press("End");
        await expect(tool.getByRole("menuitem", { name: "Insertar", exact: true })).toBeFocused();
        await tool.keyboard.press("ArrowRight");
        const submenu = tool.getByRole("menu", { name: "Insertar", exact: true });
        await expect(submenu).toBeVisible();
        await expect
          .poll(() => submenu.evaluate((element) => element.contains(document.activeElement)))
          .toBe(true);
        await tool.keyboard.press("End");
        const credentialItem = tool.getByRole("menuitem", { name: "Contraseña…" });
        await expect(credentialItem).toBeFocused();
        if (variant.zoom === 2) {
          await expect
            .poll(() =>
              tool.evaluate(() =>
                document.getAnimations().every((animation) => animation.playState !== "running"),
              ),
            )
            .toBe(true);
          await writeFile(
            test.info().outputPath(`context-keyboard-${attempt}-geometry.json`),
            JSON.stringify(
              await credentialItem.evaluate((element) => {
                const ancestors = [];
                for (
                  let current: Element | null = element;
                  current;
                  current = current.parentElement
                ) {
                  const style = getComputedStyle(current);
                  ancestors.push({
                    tag: current.tagName,
                    role: current.getAttribute("role"),
                    classes: current.className,
                    rect: current.getBoundingClientRect().toJSON(),
                    scrollTop: current.scrollTop,
                    scrollLeft: current.scrollLeft,
                    clientWidth: current.clientWidth,
                    clientHeight: current.clientHeight,
                    scrollWidth: current.scrollWidth,
                    scrollHeight: current.scrollHeight,
                    transform: style.transform,
                    overflowX: style.overflowX,
                    overflowY: style.overflowY,
                  });
                }
                return {
                  viewport: { width: innerWidth, height: innerHeight },
                  focused: document.activeElement === element,
                  ancestors,
                };
              }),
              null,
              2,
            ),
          );
          await writeFile(
            test.info().outputPath(`context-keyboard-${attempt}-native.png`),
            Buffer.from(await captureTool(), "base64"),
          );
        }
        await expect
          .poll(() =>
            credentialItem.evaluate((element) => ({
              horizontal: element.scrollWidth <= element.clientWidth,
              vertical: element.scrollHeight <= element.clientHeight,
            })),
          )
          .toEqual({ horizontal: true, vertical: true });
        await expect(credentialItem).toBeInViewport({ ratio: 1 });
      };
      await openCredentialWithKeyboard("first");
      await tool.keyboard.press("Escape");
      await expect(tool.getByRole("menu")).toHaveCount(0);
      await expect(editor).toBeFocused();
      await openCredentialWithKeyboard("second");
      await tool.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(editor).toBeFocused();
      // Estado sintético de bloqueo definitivo: se abre la confirmación sin ejecutarla.
      await app.evaluate(({ ipcMain }) => {
        const handlers = (
          ipcMain as unknown as {
            _invokeHandlers: Map<
              string,
              (
                event: Electron.IpcMainInvokeEvent,
                channel: string,
                payload: unknown,
              ) => Promise<unknown>
            >;
          }
        )._invokeHandlers;
        const original = handlers.get("lensdesk:tool-invoke");
        if (!original) throw new Error("Falta el receptor de herramientas");
        ipcMain.removeHandler("lensdesk:tool-invoke");
        ipcMain.handle("lensdesk:tool-invoke", async (event, channel, payload) => {
          const result = (await original(event, channel, payload)) as {
            ok: boolean;
            data: { unlocked: boolean; lockout: { password: { stage: string } } };
          };
          if (
            channel === "backend.invoke" &&
            (payload as { method?: string }).method === "vaultStatus" &&
            result.ok
          ) {
            result.data.unlocked = false;
            result.data.lockout.password.stage = "exhausted";
          }
          return result;
        });
      });
      const wipe = tool.getByRole("button", { name: "Restablecer notas privadas", exact: true });
      await wipe.click();
      await checkDialog("wipe");
      await tool.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(wipe).toBeFocused();
    } finally {
      await app.close().catch(() => undefined);
      await rm(profile, { recursive: true, force: true });
    }
  });
}
