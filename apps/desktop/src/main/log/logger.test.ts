import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLogger, describeError, sanitizeLogMessage } from "./logger.ts";

const dirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "lensdesk-log-"));
  dirs.push(dir);
  return dir;
};
const now = () => new Date("2026-10-15T12:00:00.000Z");
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("logger", () => {
  it("escribe una línea JSON con ts, level, event y message", () => {
    const dir = join(tempDir(), "logs");
    const logger = createLogger({ dir, maxBytes: 1024 * 1024, maxFiles: 5, now });
    logger.error("main.uncaughtException", "Error: algo falló");
    logger.info("backend.exit", "toolId=notes code=0");
    const lines = readFileSync(join(dir, "lensdesk.log"), "utf8").trim().split("\n");
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      {
        ts: "2026-10-15T12:00:00.000Z",
        level: "error",
        event: "main.uncaughtException",
        message: "Error: algo falló",
      },
      {
        ts: "2026-10-15T12:00:00.000Z",
        level: "info",
        event: "backend.exit",
        message: "toolId=notes code=0",
      },
    ]);
  });

  it("rota al superar el límite y conserva como máximo 5 archivos", () => {
    const dir = tempDir();
    const maxBytes = 1024 * 1024;
    const logger = createLogger({ dir, maxBytes, maxFiles: 5, now });
    // ~2 KB por línea: 3000 líneas son unos 6 MB, más de lo que caben en 5 archivos.
    const chunk = "x".repeat(1900);
    for (let index = 0; index < 3000; index++) logger.warn("relleno", `${index} ${chunk}`);
    const files = readdirSync(dir).sort();
    expect(files).toEqual([
      "lensdesk.1.log",
      "lensdesk.2.log",
      "lensdesk.3.log",
      "lensdesk.4.log",
      "lensdesk.log",
    ]);
    for (const file of files) expect(statSync(join(dir, file)).size).toBeLessThanOrEqual(maxBytes);
    // El más reciente queda en lensdesk.log y el anterior en lensdesk.1.log.
    const last = JSON.parse(
      readFileSync(join(dir, "lensdesk.log"), "utf8").trim().split("\n").at(-1) ?? "",
    );
    expect(last.message.startsWith("2999 ")).toBe(true);
    const previous = readFileSync(join(dir, "lensdesk.1.log"), "utf8").trim().split("\n");
    expect(JSON.parse(previous.at(-1) ?? "").message.startsWith("2999 ")).toBe(false);
  });

  it("rota un archivo existente que ya supera 1 MB antes de escribir", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "lensdesk.log"), "y".repeat(1024 * 1024 + 1));
    const logger = createLogger({ dir, maxBytes: 1024 * 1024, maxFiles: 5, now });
    logger.info("app.start", "listo");
    expect(statSync(join(dir, "lensdesk.1.log")).size).toBe(1024 * 1024 + 1);
    expect(JSON.parse(readFileSync(join(dir, "lensdesk.log"), "utf8")).event).toBe("app.start");
  });

  it("nunca lanza aunque el directorio no se pueda crear", () => {
    const dir = tempDir();
    const blocker = join(dir, "archivo");
    writeFileSync(blocker, "");
    const logger = createLogger({ dir: join(blocker, "logs"), maxBytes: 10, maxFiles: 5, now });
    expect(() => logger.error("x", "y")).not.toThrow();
  });

  it("quita rutas absolutas de los mensajes y conserva las URL", () => {
    expect(sanitizeLogMessage("ENOENT: no such file, open '/Users/ana/notas/plan.md'")).toBe(
      "ENOENT: no such file, open '<ruta>'",
    );
    expect(sanitizeLogMessage("falló C:\\Users\\ana\\doc.pdf al leer")).toBe(
      "falló <ruta> al leer",
    );
    expect(sanitizeLogMessage("GET https://api.github.com/repos/a/b respondió 500")).toBe(
      "GET https://api.github.com/repos/a/b respondió 500",
    );
    expect(sanitizeLogMessage("z".repeat(5000)).length).toBeLessThanOrEqual(2001);
  });

  it("describe errores sin pila", () => {
    const error = Object.assign(new Error("sin acceso"), { code: "EACCES" });
    expect(describeError(error)).toBe("Error EACCES: sin acceso");
    expect(describeError("texto")).toBe("texto");
  });
});
