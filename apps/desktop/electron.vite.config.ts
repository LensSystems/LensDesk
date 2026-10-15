// electron-vite se ejecuta siempre con el cwd en apps/desktop (pnpm --filter @lensdesk/desktop ...).
// Salidas — deben coincidir caracter por caracter con package.json#main y con los Verify:
//   out/main/index.js · out/main/smoke-utility.js · out/preload/host.cjs · out/preload/tool.cjs
//   out/renderer/index.html
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";

const appDir = process.cwd();

const rootPackage = JSON.parse(readFileSync(resolve(appDir, "../../package.json"), "utf8")) as {
  lensdesk?: { releasesRepo?: string };
};
const releasesRepo = rootPackage.lensdesk?.releasesRepo ?? "";

// Solo entran las entradas que ya existen: asi este archivo no se edita al agregar una nueva.
function existing(entries: Record<string, string>): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [name, file] of Object.entries(entries)) {
    const absolute = resolve(appDir, file);
    if (existsSync(absolute)) found[name] = absolute;
  }
  return found;
}

// CSP del shell: se inyecta solo en el build (en dev, el HMR de Vite necesita scripts en linea).
const shellCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function shellCspPlugin(): Plugin {
  return {
    name: "lensdesk-shell-csp",
    apply: "build",
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${shellCsp}" />`;
      return html.replace("<head>", `<head>\n    ${meta}`);
    },
  };
}

export default defineConfig({
  main: {
    define: {
      __RELEASES_REPO__: JSON.stringify(releasesRepo),
    },
    build: {
      outDir: resolve(appDir, "out/main"),
      rollupOptions: {
        input: existing({
          index: "src/main/index.ts",
          "smoke-utility": "src/main/smoke-utility.ts",
        }),
        output: {
          format: "es",
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name]-[hash].js",
        },
      },
    },
  },
  preload: {
    build: {
      outDir: resolve(appDir, "out/preload"),
      rollupOptions: {
        // Un preload con sandbox debe ser CommonJS y autocontenido: no puede hacer require de
        // un chunk. Los dos preloads no comparten ningun modulo en tiempo de ejecucion.
        input: existing({
          host: "src/preload/host.ts",
          tool: "src/preload/tool.ts",
        }),
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
          chunkFileNames: "chunks/[name]-[hash].cjs",
        },
      },
    },
  },
  renderer: {
    root: resolve(appDir, "src/renderer"),
    plugins: [react(), tailwindcss(), shellCspPlugin()],
    build: {
      outDir: resolve(appDir, "out/renderer"),
      rollupOptions: {
        input: resolve(appDir, "src/renderer/index.html"),
      },
    },
  },
});
