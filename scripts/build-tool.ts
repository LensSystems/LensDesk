// Compila una herramienta de LensDesk. Se ejecuta con el cwd en el directorio de la herramienta:
//   node ../../scripts/build-tool.ts [--backend-only]
// Produce:
//   dist/lensdesk.tool.json        copia del manifiesto
//   dist/ui/**                     build de Vite de src/ui (omitido con --backend-only)
//   dist/backend/index.js          bundle ESM autocontenido de src/backend/index.ts (si el manifiesto declara backend)
//   dist/backend/package.json      { "type": "module" } para que utilityProcess cargue index.js como ESM
// Codigos: 0 = correcto · 1 = la herramienta es inconsistente · 2 = uso incorrecto
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { build } from "vite";

type ToolManifest = { version?: unknown; backend?: { entry?: unknown } };

function fail(message: string, code: number): never {
  console.error(`build-tool: ${message}`);
  process.exit(code);
}

const toolDir = process.cwd();
const backendOnly = process.argv.includes("--backend-only");
const manifestPath = resolve(toolDir, "lensdesk.tool.json");
const packagePath = resolve(toolDir, "package.json");

if (!existsSync(manifestPath)) fail(`no existe ${manifestPath}`, 2);
if (!existsSync(packagePath)) fail(`no existe ${packagePath}`, 2);

const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ToolManifest;
const toolPackage = JSON.parse(readFileSync(packagePath, "utf8")) as { version?: unknown };

if (manifest.version !== toolPackage.version) {
  fail("`version` de lensdesk.tool.json y de package.json deben ser iguales", 1);
}

const distDir = resolve(toolDir, "dist");
const uiRoot = resolve(toolDir, "src/ui");
const backendEntry = resolve(toolDir, "src/backend/index.ts");
const declaresBackend = typeof manifest.backend?.entry === "string";

if (declaresBackend !== existsSync(backendEntry)) {
  fail("el manifiesto declara `backend.entry` si y solo si existe src/backend/index.ts", 1);
}
if (backendOnly && !declaresBackend) fail("--backend-only requiere una herramienta con backend", 1);
if (!backendOnly && !existsSync(resolve(uiRoot, "index.html"))) {
  fail("falta src/ui/index.html", 1);
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

if (!backendOnly) {
  await build({
    configFile: false,
    root: uiRoot,
    base: "./",
    logLevel: "warn",
    plugins: [react(), tailwindcss()],
    build: {
      outDir: resolve(distDir, "ui"),
      emptyOutDir: true,
    },
  });
}

if (declaresBackend) {
  await build({
    configFile: false,
    root: toolDir,
    logLevel: "warn",
    ssr: { noExternal: true },
    build: {
      ssr: backendEntry,
      outDir: resolve(distDir, "backend"),
      emptyOutDir: true,
      target: "node24",
      rollupOptions: {
        output: {
          format: "es",
          entryFileNames: "index.js",
          inlineDynamicImports: true,
        },
      },
    },
  });
  writeFileSync(resolve(distDir, "backend/package.json"), '{ "type": "module" }\n');
}

cpSync(manifestPath, resolve(distDir, "lensdesk.tool.json"));
console.log(`build-tool: listo en ${distDir}`);
