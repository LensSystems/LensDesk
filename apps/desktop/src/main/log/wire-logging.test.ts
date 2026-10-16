import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { Logger } from "./logger.ts";
import {
  logBackendExit,
  logBackendMessage,
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

  it("avisa de cada error no capturado con su tipo, sin el mensaje", () => {
    const target = new EventEmitter();
    const notify = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logProcessErrors(target as never, fakeLogger(), notify);
    target.emit("uncaughtException", new Error("secreto"));
    target.emit("unhandledRejection", "otro secreto");
    consoleError.mockRestore();
    expect(notify.mock.calls).toEqual([["uncaught"], ["rejection"]]);
  });

  it("no deja escapar un fallo del aviso fuera del manejador", () => {
    const target = new EventEmitter();
    const logger = fakeLogger();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logProcessErrors(target as never, logger, () => {
      throw new Error("Object has been destroyed");
    });
    expect(() => target.emit("uncaughtException", new Error("x"))).not.toThrow();
    expect(() => target.emit("unhandledRejection", "y")).not.toThrow();
    consoleError.mockRestore();
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it("registra un mensaje de backend solo con herramienta y longitud, nunca el texto", () => {
    const logger = fakeLogger();
    logBackendMessage(logger, "notes", "warn", "contraseña=hunter2");
    logBackendMessage(logger, "notes", "error", "otro texto");
    logBackendMessage(logger, "notes", "debug", "x");
    expect(logger.warn).toHaveBeenCalledWith("backend.log", "toolId=notes length=18");
    expect(logger.error).toHaveBeenCalledWith("backend.log", "toolId=notes length=10");
    expect(logger.info).toHaveBeenCalledWith("backend.log", "toolId=notes length=1");
    const written = [logger.info, logger.warn, logger.error].flatMap((fn) => fn.mock.calls.flat());
    expect(written.join(" ")).not.toMatch(/hunter2|otro texto/);
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
