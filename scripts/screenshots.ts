import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ElectronApplication, Page } from "@playwright/test";
import { _electron as electron, expect } from "@playwright/test";
import { enableDeveloperMode, stubDialog, toolPage } from "../tests/e2e/helpers.ts";
import type { Bitmap } from "./screenshot-images.ts";
import { composeBitmaps, differentPixels } from "./screenshot-images.ts";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const css =
  "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}.cm-cursor,.cm-dropCursor{visibility:hidden!important}";
// El aviso de versiones depende de la red y no forma parte de las pantallas.
const shellCss = `${css}header > [role="status"]{display:none!important}`;
const sample =
  "# Guía del proyecto\n\nTodo queda guardado localmente.\n\n- Revisar cambios\n- Ejecutar pruebas\n\n```ts\nconst saludo = 'Hola, LensDesk';\nconsole.log(saludo);\n```";

function options() {
  const args = process.argv.slice(2);
  let out = resolve(root, "screenshots");
  let compare: string | undefined;
  let accent = "blue";
  let size: [number, number] | undefined;
  while (args.length) {
    const flag = args.shift();
    const value = args.shift();
    if (
      (flag !== "--out" && flag !== "--compare" && flag !== "--accent" && flag !== "--size") ||
      !value ||
      value.startsWith("--")
    ) {
      throw new Error(
        "Uso: pnpm screenshots [--out carpeta] [--compare carpeta] [--accent blue|green] [--size ANCHOxALTO (760x520)]",
      );
    }
    if (flag === "--out") out = resolve(value);
    else if (flag === "--compare") compare = resolve(value);
    else if (flag === "--size") {
      if (!/^[1-9]\d*x[1-9]\d*$/.test(value)) throw new Error("Tamaño inválido");
      const [width = 0, height = 0] = value.split("x").map(Number);
      if (
        !Number.isSafeInteger(width) ||
        !Number.isSafeInteger(height) ||
        width < 760 ||
        height < 520
      )
        throw new Error("Tamaño mínimo: 760x520");
      size = [width, height];
    } else {
      if (value !== "blue" && value !== "green") throw new Error("Acento inválido");
      accent = value;
    }
  }
  if (out === compare) throw new Error("Salida y referencia deben ser carpetas diferentes.");
  return { out, compare, accent, size };
}

async function packages() {
  for (const file of [
    "main/index.js",
    "preload/host.cjs",
    "preload/tool.cjs",
    "renderer/index.html",
  ]) {
    await access(join(root, "apps/desktop/out", file)).catch(() => {
      throw new Error("Falta la app compilada. Ejecuta pnpm build.");
    });
  }
  return Promise.all(
    ["notes", "md-converter", "_template"].map(async (tool) => {
      const directory = join(root, "tools", tool, "dist");
      const files = (await readdir(directory).catch(() => []))
        .filter((name) => name.endsWith(".lenspkg"))
        .sort();
      if (files.length !== 1)
        throw new Error(
          `Se necesita un único tools/${tool}/dist/*.lenspkg. Ejecuta pnpm tools:package y elimina paquetes antiguos.`,
        );
      return join(directory, files[0] as string);
    }),
  );
}

async function stabilize(page: Page, content = css) {
  await page.addStyleTag({ content });
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    await document.fonts.ready;
    await new Promise<void>((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done())),
    );
  });
}

async function capture(app: ElectronApplication, shell: Page, tool?: Page) {
  await stabilize(shell, shellCss);
  if (tool) await stabilize(tool);
  const raw = await app.evaluate(async ({ BrowserWindow }, toolUrl) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) throw new Error("No hay ventana principal");
    const encode = (image: Electron.NativeImage) => {
      // Una representación explícita evita mezclar píxeles físicos y coordenadas DIP.
      const size = image.getSize();
      const bitmap = image.toBitmap({ scaleFactor: 1 });
      return { ...size, data: bitmap.toString("base64") };
    };
    const shellImage = encode(await window.webContents.capturePage());
    const view = window.contentView.children.find(
      (child) =>
        "webContents" in child &&
        (child as Electron.WebContentsView).webContents.getURL() === toolUrl,
    );
    if (toolUrl && !view) throw new Error("La vista de herramienta no está visible");
    const bounds = view?.getBounds();
    const image = view
      ? encode(await (view as Electron.WebContentsView).webContents.capturePage())
      : null;
    return { shell: shellImage, view: image, bounds, content: window.getContentBounds() };
  }, tool?.url());
  let bitmap: Bitmap = { ...raw.shell, data: Buffer.from(raw.shell.data, "base64") };
  if (raw.view && raw.bounds) {
    const scaleX = bitmap.width / raw.content.width;
    const scaleY = bitmap.height / raw.content.height;
    const view: Bitmap = { ...raw.view, data: Buffer.from(raw.view.data, "base64") };
    if (
      view.width !== Math.round(raw.bounds.width * scaleX) ||
      view.height !== Math.round(raw.bounds.height * scaleY)
    ) {
      throw new Error("Las escalas del shell y de la herramienta no coinciden");
    }
    bitmap = composeBitmaps(
      bitmap,
      view,
      Math.round(raw.bounds.x * scaleX),
      Math.round(raw.bounds.y * scaleY),
    );
  }
  return bitmap;
}

async function save(app: ElectronApplication, shell: Page, file: string, tool?: Page) {
  let previous = await capture(app, shell, tool);
  let stable = 0;
  for (let attempt = 0; attempt < 40; attempt++) {
    await shell.waitForTimeout(100);
    const next = await capture(app, shell, tool);
    stable = differentPixels(previous, next) === 0 ? stable + 1 : 0;
    previous = next;
    if (stable >= 3) {
      const png = await app.evaluate(
        ({ nativeImage }, image) =>
          nativeImage
            .createFromBitmap(Buffer.from(image.data, "base64"), {
              width: image.width,
              height: image.height,
              scaleFactor: 1,
            })
            .toPNG()
            .toString("base64"),
        { ...next, data: Buffer.from(next.data).toString("base64") },
      );
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(png, "base64"));
      return;
    }
  }
  throw new Error(`La interfaz no se estabilizó: ${file}`);
}

async function decode(app: ElectronApplication, file: string): Promise<Bitmap> {
  const encoded = (await readFile(file)).toString("base64");
  const raw = await app.evaluate(({ nativeImage }, png) => {
    const image = nativeImage.createFromBuffer(Buffer.from(png, "base64"));
    if (image.isEmpty()) throw new Error("PNG inválido");
    return { ...image.getSize(), data: image.toBitmap({ scaleFactor: 1 }).toString("base64") };
  }, encoded);
  return { ...raw, data: Buffer.from(raw.data, "base64") };
}

async function pngFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
    .map((entry) => resolve(entry.parentPath, entry.name).slice(resolve(directory).length + 1));
}

async function run() {
  const { out, compare, accent, size } = options();
  const pkgs = await packages();
  if (compare) await access(compare);
  const generated = new Set<string>();
  let changed = false;
  for (const [theme, label] of [
    ["light", "Claro"],
    ["dark", "Oscuro"],
  ] as const) {
    const temporary = await mkdtemp(join(tmpdir(), "lensdesk-screenshots-"));
    let app: ElectronApplication | undefined;
    try {
      app = await electron.launch({
        executablePath: require("electron") as string,
        // Dibujado por software y sin repintados parciales: los bordes suavizados no varían entre
        // ejecuciones.
        args: [
          join(root, "apps/desktop"),
          "--force-device-scale-factor=1",
          "--disable-gpu",
          "--disable-partial-raster",
        ],
        env: {
          ...process.env,
          LENSDESK_USER_DATA: join(temporary, "profile"),
          LENSDESK_DEV_TOOLS_DIR: "",
          ELECTRON_RENDERER_URL: "",
        },
      });
      const shell = await app.firstWindow();
      await app.evaluate(({ BrowserWindow }, size) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (size) window?.setSize(...size);
        else window?.setContentSize(1280, 800);
      }, size);
      await shell.getByRole("button", { name: "Ajustes", exact: true }).click();
      const updates = shell.getByRole("switch", { name: "Buscar actualizaciones", exact: true });
      if ((await updates.getAttribute("aria-checked")) === "true") await updates.click();
      await expect(updates).toHaveAttribute("aria-checked", "false");
      await shell.getByRole("combobox", { name: "Idioma", exact: true }).click();
      await shell.getByRole("option", { name: "Español", exact: true }).click();
      await shell
        .getByRole("radiogroup", { name: "Tema", exact: true })
        .getByRole("radio", { name: label, exact: true })
        .click();
      await expect(shell.locator("html")).toHaveAttribute("data-theme", theme);
      await shell
        .getByRole("radiogroup", { name: "Color de acento", exact: true })
        .getByRole("radio", { name: accent === "green" ? "Verde" : "Azul", exact: true })
        .click();
      if (accent === "green")
        await expect(shell.locator("html")).toHaveAttribute("data-accent", "green");
      const snap = async (name: string, tool?: Page) => {
        const relative = join(theme, `${name}.png`);
        generated.add(relative);
        await save(app as ElectronApplication, shell, join(out, relative), tool);
        if (!compare) console.log(`Guardada: ${relative}`);
        else {
          const reference = join(compare, relative);
          const exists = await access(reference).then(
            () => true,
            () => false,
          );
          if (!exists) {
            console.log(`${relative}: nueva`);
            changed = true;
          } else {
            const count = differentPixels(
              await decode(app as ElectronApplication, join(out, relative)),
              await decode(app as ElectronApplication, reference),
            );
            console.log(`${relative}: ${count ? `distinta (${count} píxeles)` : "igual"}`);
            changed ||= count > 0;
          }
        }
      };
      await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
      await expect(shell.getByText("Aún no hay herramientas", { exact: true })).toBeVisible();
      await snap("herramientas-vacia");
      await enableDeveloperMode(shell);
      for (const [index, name] of ["Notas", "Convertidor", "Plantilla"].entries()) {
        await stubDialog(app, "open", { canceled: false, filePaths: [pkgs[index]] });
        await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
        await shell.getByRole("button", { name: "Agregar herramienta…" }).click();
        await expect(
          shell.getByRole("button", { name: `Abrir ${name}`, exact: true }),
        ).toBeVisible();
      }
      await snap("herramientas");
      await shell.getByRole("button", { name: "Ajustes", exact: true }).click();
      await expect(shell.getByText(/^Versión /)).not.toContainText("Cargando");
      await snap("ajustes");
      const open = async (name: string, id: string) => {
        await shell.getByRole("button", { name: "Herramientas", exact: true }).click();
        await shell.getByRole("button", { name: `Abrir ${name}`, exact: true }).click();
        const tool = await toolPage(app as ElectronApplication, id);
        await expect(tool.locator("html")).toHaveAttribute("data-theme", theme);
        return tool;
      };
      const notes = await open("Notas", "notes");
      await notes.getByRole("button", { name: "Nueva nota" }).first().click();
      await notes
        .locator(".cm-content")
        .fill("# Borrador archivado\n\nIdeas para revisar más adelante.");
      await notes.waitForTimeout(1000);
      await expect(
        notes.getByRole("button", { name: "Borrador archivado", exact: true }),
      ).toBeVisible();
      await notes.getByRole("button", { name: "Mover a la papelera" }).first().click();
      await expect(
        notes.getByRole("button", { name: "Borrador archivado", exact: true }),
      ).toHaveCount(0);
      await notes.getByRole("button", { name: "Nueva nota" }).first().click();
      await notes.locator(".cm-content").fill(sample);
      await notes.waitForTimeout(1000);
      await expect(notes.getByRole("heading", { name: "Guía del proyecto" })).toBeVisible();
      await snap("notas-edicion", notes);
      await notes.getByRole("radio", { name: "Vista previa", exact: true }).click();
      await snap("notas-vista-previa", notes);
      await notes.getByRole("radio", { name: "Papelera", exact: true }).click();
      await expect(
        notes.getByRole("button", { name: "Borrador archivado", exact: true }),
      ).toBeVisible();
      await snap("notas-papelera", notes);
      const converter = await open("Convertidor", "md-converter");
      await expect(converter.getByText("La cola está vacía.", { exact: true })).toBeVisible();
      await snap("convertidor-vacio", converter);
      const input = join(temporary, "ejemplo.html");
      await writeFile(
        input,
        "<h1>Resumen del proyecto</h1><p>Documentación local.</p><ul><li>Notas</li><li>Pruebas</li></ul>",
      );
      await stubDialog(app, "open", { canceled: false, filePaths: [input] });
      await converter.getByRole("button", { name: "Elegir archivos…" }).click();
      await expect(converter.getByRole("list", { name: "Cola de conversión" })).toContainText(
        "Listo",
      );
      await converter.getByRole("button", { name: "ejemplo.html", exact: true }).click();
      await snap("convertidor-resultado", converter);
      const template = await open("Plantilla", "template");
      await snap("plantilla", template);
    } finally {
      try {
        await app?.close();
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    }
  }
  if (compare)
    for (const file of (await pngFiles(compare)).sort()) {
      if (!generated.has(file)) {
        console.log(`${file}: falta`);
        changed = true;
      }
    }
  process.exitCode = changed ? 1 : 0;
}

await run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
