import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron } from "@playwright/test";
import { buildIco, iconSizes, iconSource, iconsetFiles } from "./icon-files.ts";

const root = resolve(import.meta.dirname, "..");
const build = join(root, "apps/desktop/build");
const require = createRequire(import.meta.url);
const sdkRequire = createRequire(join(root, "packages/sdk/package.json"));
const macScale = 824 / 1024;
const temporary = await mkdtemp(join(tmpdir(), "lensdesk-icons-"));
// Las letras permanecen como texto SVG; sin dependencias adicionales, Manrope empaquetada e
// incrustada garantiza su dibujo sin depender de fuentes instaladas ni convertirlas a trazos.
const font = (
  await readFile(
    sdkRequire.resolve("@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2"),
  )
).toString("base64");

async function run() {
  const app = await electron.launch({
    executablePath: require("electron") as string,
    args: [
      join(import.meta.dirname, "icon-host.cjs"),
      "--force-device-scale-factor=1",
      "--disable-gpu",
    ],
  });
  try {
    await app.evaluate(
      ({ app }, profile) => app.setPath("userData", profile),
      join(temporary, "profile"),
    );
    const render = async (body: string, width: number, height: number) => {
      const html = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:"><style>@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:200 800}html,body{margin:0;width:100%;height:100%;background:transparent}body{font-family:Manrope}body>svg{width:100%;height:100%;display:block}</style></head><body>${body}</body></html>`;
      const encoded = await app.evaluate(
        async ({ BrowserWindow }, input) => {
          const window = new BrowserWindow({
            width: input.width,
            height: input.height,
            useContentSize: true,
            show: false,
            transparent: true,
            frame: false,
            webPreferences: {
              offscreen: true,
              contextIsolation: true,
              sandbox: true,
              nodeIntegration: false,
            },
          });
          try {
            await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(input.html)}`);
            await window.webContents.executeJavaScript(
              "document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))",
            );
            const image = await window.webContents.capturePage();
            const size = image.getSize();
            if (size.width !== input.width || size.height !== input.height)
              throw new Error("Dimensiones PNG inesperadas");
            return image.toPNG().toString("base64");
          } finally {
            window.destroy();
          }
        },
        { html, width, height },
      );
      return Buffer.from(encoded, "base64");
    };
    const images = new Map<number, Buffer>();
    for (const size of iconSizes)
      images.set(
        size,
        await render(await readFile(join(build, iconSource(size)), "utf8"), size, size),
      );
    await writeFile(join(build, "icon.png"), images.get(1024) as Buffer);
    await writeFile(join(build, "icon.ico"), buildIco(images));
    if (process.platform === "darwin") {
      const iconset = join(temporary, "LensDesk.iconset");
      await mkdir(iconset);
      // macOS dibuja el icono en un cuadro de 824 sobre 1024 px: el resto es margen transparente.
      const macImages = new Map<number, Buffer>();
      for (const size of new Set(iconsetFiles.map((file) => file.size))) {
        const svg = await readFile(join(build, iconSource(Math.round(size * macScale))), "utf8");
        const inset = (size * (1 - macScale)) / 2;
        const body = `<div style="box-sizing:border-box;width:100%;height:100%;padding:${inset}px">${svg.replace("<svg ", '<svg width="100%" height="100%" style="display:block" ')}</div>`;
        macImages.set(size, await render(body, size, size));
      }
      for (const file of iconsetFiles)
        await writeFile(join(iconset, file.name), macImages.get(file.size) as Buffer);
      execFileSync("iconutil", ["-c", "icns", iconset, "-o", join(build, "icon.icns")]);
    } else console.warn("Se omite icon.icns: iconutil requiere macOS.");
    const icon = await readFile(join(build, "icon.svg"), "utf8");
    const docs = join(root, "docs/images");
    await mkdir(docs, { recursive: true });
    for (const theme of ["light", "dark"]) {
      const dark = theme === "dark";
      const body = `<div style="width:1040px;height:280px;display:flex;align-items:center;gap:44px">${icon.replace("<svg ", '<svg width="192" height="192" style="flex-shrink:0" ')}<div><div style="font-size:112px;font-weight:800;letter-spacing:-0.03em;line-height:1.1;color:${dark ? "#EEF1F4" : "#2A2F36"}">Lens<span style="color:${dark ? "#6EA8FE" : "#2563EB"}">Desk</span></div><div style="font-size:32px;color:${dark ? "#B7C0CA" : "#4F5966"}">de LensSystems</div></div></div>`;
      await writeFile(join(docs, `logo-${theme}.png`), await render(body, 1040, 280));
    }
  } finally {
    await app.close();
  }
}

try {
  await run();
} finally {
  await rm(temporary, { recursive: true, force: true });
}
