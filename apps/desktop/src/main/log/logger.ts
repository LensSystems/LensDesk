import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export type LogLevel = "info" | "warn" | "error";
export type Logger = {
  info(event: string, message: string): void;
  warn(event: string, message: string): void;
  error(event: string, message: string): void;
};

const FILE_NAME = "lensdesk.log";
const MAX_MESSAGE_LENGTH = 2000;
// Una ruta absoluta (POSIX o Windows) al inicio, tras un espacio, una comilla, "(" o "=". Una URL
// no coincide porque su barra va precedida de ":".
const ABSOLUTE_PATH = /(^|[\s'"`(=])(?:\/[^\s'"`)]+|[A-Za-z]:\\[^\s'"`)]*|\\\\[^\s'"`)]+)/g;

// Quita rutas absolutas y recorta: un registro nunca debe llevar rutas de archivos del usuario.
export function sanitizeLogMessage(message: string): string {
  const clean = message.replace(ABSOLUTE_PATH, "$1<ruta>");
  return clean.length > MAX_MESSAGE_LENGTH ? `${clean.slice(0, MAX_MESSAGE_LENGTH)}…` : clean;
}

// Convierte cualquier valor lanzado en un mensaje corto, sin pila (la pila lleva rutas).
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return `${error.name}${typeof code === "string" ? ` ${code}` : ""}: ${error.message}`;
  }
  return String(error);
}

export function rotatedName(index: number): string {
  return index === 0 ? FILE_NAME : `lensdesk.${index}.log`;
}

export function createLogger(options: {
  dir: string;
  maxBytes: number;
  maxFiles: number;
  now: () => Date;
}): Logger {
  const current = join(options.dir, FILE_NAME);
  const rotate = (): void => {
    rmSync(join(options.dir, rotatedName(options.maxFiles - 1)), { force: true });
    for (let index = options.maxFiles - 2; index >= 0; index--) {
      try {
        renameSync(
          join(options.dir, rotatedName(index)),
          join(options.dir, rotatedName(index + 1)),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  };
  const write = (level: LogLevel, event: string, message: string): void => {
    const line = `${JSON.stringify({
      ts: options.now().toISOString(),
      level,
      event,
      message: sanitizeLogMessage(message),
    })}\n`;
    try {
      mkdirSync(options.dir, { recursive: true });
      let size = 0;
      try {
        size = statSync(current).size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (size > 0 && size + Buffer.byteLength(line) > options.maxBytes) rotate();
      appendFileSync(current, line, "utf8");
    } catch {
      // Un fallo al escribir el registro nunca debe tumbar la app.
    }
  };
  return {
    info: (event, message) => write("info", event, message),
    warn: (event, message) => write("warn", event, message),
    error: (event, message) => write("error", event, message),
  };
}
