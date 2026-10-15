// Ejecuta la app con --smoke y decide el resultado SOLO por codigo de salida y lineas exactas.
// Uso:  node scripts/smoke-check.ts [--exe <binario empaquetado>] [CHECK ...]
//   sin --exe : ejecuta `electron apps/desktop --smoke` (requiere `pnpm build` antes)
//   CHECK     : exige ademas la linea LENSDESK_SMOKE_<CHECK>_OK (ej. DB FTS5_MAIN FTS5_UTILITY TOOLS)
// Codigos: 0 = correcto · 1 = la app fallo o falta una linea · 2 = uso incorrecto
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const checks: string[] = [];
let exe: string | undefined;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === undefined) continue;
  if (arg === "--exe") {
    const value = args[index + 1];
    if (value === undefined) {
      console.error("smoke-check: --exe necesita una ruta");
      process.exit(2);
    }
    exe = value;
    index += 1;
  } else if (/^[A-Z0-9_]+$/.test(arg)) {
    checks.push(arg);
  } else {
    console.error(`smoke-check: argumento no reconocido: ${arg}`);
    process.exit(2);
  }
}

const appPackage = JSON.parse(readFileSync(resolve(root, "apps/desktop/package.json"), "utf8")) as {
  version: string;
};

const command = exe ?? (createRequire(import.meta.url)("electron") as string);
const commandArgs = exe ? ["--smoke"] : [resolve(root, "apps/desktop"), "--smoke"];
const { ELECTRON_RUN_AS_NODE: _runAsNode, ...env } = process.env;

const result = spawnSync(command, commandArgs, { encoding: "utf8", env, timeout: 120_000 });
const stdout = result.stdout ?? "";
const smokeLines = stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.startsWith("LENSDESK_SMOKE_"));

const expectedFirst = `LENSDESK_SMOKE_OK ${appPackage.version}`;
const problems: string[] = [];

if (result.error) problems.push(`no se pudo ejecutar ${command}: ${result.error.message}`);
if (result.status !== 0) problems.push(`codigo de salida ${String(result.status)} (se esperaba 0)`);
if (smokeLines[0] !== expectedFirst) {
  problems.push(`primera linea "${smokeLines[0] ?? ""}" (se esperaba "${expectedFirst}")`);
}
for (const check of checks) {
  const expected = `LENSDESK_SMOKE_${check}_OK`;
  if (!smokeLines.includes(expected)) problems.push(`falta la linea ${expected}`);
}

if (problems.length > 0) {
  console.error("smoke-check: FALLO");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("--- stdout ---");
  console.error(stdout);
  console.error("--- stderr ---");
  console.error(result.stderr ?? "");
  process.exit(1);
}

for (const line of smokeLines) console.log(line);
