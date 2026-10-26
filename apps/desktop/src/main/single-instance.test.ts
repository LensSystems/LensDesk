import { describe, expect, it, vi } from "vitest";
import { configureSingleInstance } from "./single-instance.ts";

function setup(locked = true) {
  const window = {
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
  };
  const options = {
    requestLock: vi.fn(() => locked),
    quit: vi.fn(),
    onSecondInstance: vi.fn<(listener: () => void) => void>(),
    getWindow: vi.fn<() => typeof window | undefined>(() => window),
  };
  const result = configureSingleInstance(options);
  const secondInstance = () => options.onSecondInstance.mock.calls[0]?.[0]();
  return { window, options, result, secondInstance };
}

describe("configureSingleInstance", () => {
  it("sale inmediatamente sin registrar eventos si no obtiene el bloqueo", () => {
    const { options, result } = setup(false);
    expect(result).toBe(false);
    expect(options.requestLock).toHaveBeenCalledTimes(1);
    expect(options.quit).toHaveBeenCalledTimes(1);
    expect(options.onSecondInstance).not.toHaveBeenCalled();
    expect(options.getWindow).not.toHaveBeenCalled();
  });

  it("permite arrancar y registra una sola escucha al obtener el bloqueo", () => {
    const { options, result } = setup();
    expect(result).toBe(true);
    expect(options.requestLock).toHaveBeenCalledTimes(1);
    expect(options.quit).not.toHaveBeenCalled();
    expect(options.onSecondInstance).toHaveBeenCalledTimes(1);
    expect(options.getWindow).not.toHaveBeenCalled();
  });

  it.each([false, true])("muestra y enfoca la ventana minimizada=%s", (minimized) => {
    const { window, secondInstance } = setup();
    window.isMinimized.mockReturnValue(minimized);
    secondInstance();
    expect(window.restore).toHaveBeenCalledTimes(minimized ? 1 : 0);
    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.focus).toHaveBeenCalledTimes(1);
    if (minimized) {
      expect(window.restore.mock.invocationCallOrder[0]).toBeLessThan(
        window.show.mock.invocationCallOrder[0] as number,
      );
    }
    expect(window.show.mock.invocationCallOrder[0]).toBeLessThan(
      window.focus.mock.invocationCallOrder[0] as number,
    );
  });

  it("consulta la ventana actual en cada segundo arranque", () => {
    const { options, window, secondInstance } = setup();
    options.getWindow.mockReturnValueOnce(undefined);
    secondInstance();
    expect(window.show).not.toHaveBeenCalled();
    secondInstance();
    expect(window.focus).toHaveBeenCalledTimes(1);
  });

  it("ignora una ventana destruida", () => {
    const { window, secondInstance } = setup();
    window.isDestroyed.mockReturnValue(true);
    secondInstance();
    expect(window.restore).not.toHaveBeenCalled();
    expect(window.show).not.toHaveBeenCalled();
    expect(window.focus).not.toHaveBeenCalled();
  });
});

describe("arranque de main", () => {
  it("pide el bloqueo antes de abrir el registro o la base de datos", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const lock = source.indexOf("configureSingleInstance({");
    expect(lock).toBeGreaterThan(source.indexOf("configureRuntime("));
    expect(lock).toBeLessThan(source.indexOf("createMainLogger("));
    expect(lock).toBeLessThan(source.indexOf("openHostDatabase("));
    expect(lock).toBeLessThan(source.indexOf("createToolWiring("));
  });
});
