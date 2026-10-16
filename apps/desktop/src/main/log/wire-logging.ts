import type { ProcessErrorKind } from "./error-notifier.ts";
import { describeError, type Logger } from "./logger.ts";

type ProcessLike = {
  on(event: "uncaughtException" | "unhandledRejection", listener: (error: unknown) => void): void;
};
type ContentsLike = {
  id: number;
  on(
    event: "render-process-gone",
    listener: (event: unknown, details: { reason: string; exitCode: number }) => void,
  ): void;
};
type AppLike = {
  on(
    event: "web-contents-created",
    listener: (event: unknown, contents: ContentsLike) => void,
  ): void;
};

// Excepciones no capturadas y rechazos no manejados de main: se registran y la app sigue.
export function logProcessErrors(
  target: ProcessLike,
  logger: Logger,
  notify: (kind: ProcessErrorKind) => void = () => undefined,
): void {
  target.on("uncaughtException", (error) => {
    logger.error("main.uncaughtException", describeError(error));
    console.error(error);
    // Un fallo del aviso nunca debe escapar del manejador: Node lo trataría como fatal.
    try {
      notify("uncaught");
    } catch {}
  });
  target.on("unhandledRejection", (reason) => {
    logger.error("main.unhandledRejection", describeError(reason));
    console.error(reason);
    try {
      notify("rejection");
    } catch {}
  });
}

// Registra la caída de cualquier renderer; si era la vista de una herramienta, avisa además con
// su id para que el shell ofrezca recuperarla.
export function logRendererCrashes(
  app: AppLike,
  options: {
    logger: Logger;
    toolIdForContents(id: number): string | undefined;
    onToolCrashed(toolId: string): void;
  },
): void {
  app.on("web-contents-created", (_event, contents) => {
    const id = contents.id;
    contents.on("render-process-gone", (_goneEvent, details) => {
      const toolId = options.toolIdForContents(id);
      const clean = details.reason === "clean-exit";
      options.logger[clean ? "info" : "error"](
        "renderer.gone",
        `${toolId ? `toolId=${toolId}` : "shell"} reason=${details.reason} exitCode=${details.exitCode}`,
      );
      if (toolId && !clean) options.onToolCrashed(toolId);
    });
  });
}

export function logBackendExit(
  logger: Logger,
  toolId: string,
  code: number,
  expected: boolean,
): void {
  const message = `toolId=${toolId} code=${code}${expected ? " expected" : ""}`;
  if (code === 0 || expected) logger.info("backend.exit", message);
  else logger.error("backend.exit", message);
}

// Mensajes de `ctx.log` de un backend: se registra solo el evento (id, nivel y longitud), nunca
// el texto, que puede contener datos del usuario.
export function logBackendMessage(
  logger: Logger,
  toolId: string,
  level: string,
  message: string,
): void {
  const method = level === "error" ? "error" : level === "warn" ? "warn" : "info";
  logger[method]("backend.log", `toolId=${toolId} length=${message.length}`);
}

export function logInstallFailure(logger: Logger, error: unknown): void {
  const code = (error as { code?: unknown } | null)?.code;
  // Pedir confirmación de una versión anterior no es un fallo.
  if (code === "E_DOWNGRADE_CONFIRM") return;
  logger.error("install.failed", describeError(error));
}

export function logFileDenied(logger: Logger, toolId: string, channel: string): void {
  logger.warn("file.denied", `toolId=${toolId} channel=${channel}`);
}
