import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { Logger } from "./logger.ts";
import {
  logBackendExit,
  logFileDenied,
  logInstallFailure,
  logProcessErrors,
  logRendererCrashes,
} from "./wire-logging.ts";

const fakeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) satisfies Logger;

describe("cableado de registros", () => {
  it("registra excepciones no capturadas y rechazos no manejados", () => {
    const target = new EventEmitter();
    const logger = fakeLogger();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logProcessErrors(target as never, logger);
    target.emit("uncaughtException", new TypeError("x no es función"));
    target.emit("unhandledRejection", "rechazo");
    consoleError.mockRestore();
    expect(logger.error).toHaveBeenCalledWith(
      "main.uncaughtException",
      "TypeError: x no es función",
    );
    expect(logger.error).toHaveBeenCalledWith("main.unhandledRejection", "rechazo");
  });

  it("registra render-process-gone y avisa solo si era una herramienta", () => {
    const app = new EventEmitter();
    const logger = fakeLogger();
    const onToolCrashed = vi.fn();
    logRendererCrashes(app as never, {
      logger,
      toolIdForContents: (id) => (id === 7 ? "notes" : undefined),
      onToolCrashed,
    });
    const tool = Object.assign(new EventEmitter(), { id: 7 });
    const shell = Object.assign(new EventEmitter(), { id: 1 });
    app.emit("web-contents-created", {}, tool);
    app.emit("web-contents-created", {}, shell);
    tool.emit("render-process-gone", {}, { reason: "crashed", exitCode: 11 });
    shell.emit("render-process-gone", {}, { reason: "oom", exitCode: 1 });
    expect(onToolCrashed).toHaveBeenCalledTimes(1);
    expect(onToolCrashed).toHaveBeenCalledWith("notes");
    expect(logger.error).toHaveBeenCalledWith(
      "renderer.gone",
      "toolId=notes reason=crashed exitCode=11",
    );
    expect(logger.error).toHaveBeenCalledWith("renderer.gone", "shell reason=oom exitCode=1");
  });

  it("registra la salida de un backend como error solo si no la pidió el host", () => {
    const logger = fakeLogger();
    logBackendExit(logger, "notes", 1, false);
    logBackendExit(logger, "notes", 15, true);
    expect(logger.error).toHaveBeenCalledWith("backend.exit", "toolId=notes code=1");
    expect(logger.info).toHaveBeenCalledWith("backend.exit", "toolId=notes code=15 expected");
  });

  it("registra fallos de instalación salvo la confirmación de versión anterior", () => {
    const logger = fakeLogger();
    logInstallFailure(logger, Object.assign(new Error("firma"), { code: "E_SIGNATURE_INVALID" }));
    logInstallFailure(
      logger,
      Object.assign(new Error("confirma"), { code: "E_DOWNGRADE_CONFIRM" }),
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith("install.failed", "Error E_SIGNATURE_INVALID: firma");
  });

  it("registra accesos de archivo denegados solo con herramienta y canal", () => {
    const logger = fakeLogger();
    logFileDenied(logger, "md-converter", "files.readText");
    expect(logger.warn).toHaveBeenCalledWith(
      "file.denied",
      "toolId=md-converter channel=files.readText",
    );
  });
});
