import { describe, expect, it, vi } from "vitest";
import { createToolHandlers } from "./tool-handlers.ts";

describe("handlers de herramientas", () => {
  it("acepta archivo absoluto .lenspkg regular e instala la copia privada del instalador", async () => {
    const install = vi.fn(async () => undefined);
    const installer = {
      install,
      registry: { list: () => [], setEnabled: () => true },
      confirmDowngrade: vi.fn(),
      remove: vi.fn(),
      getPendingDowngrade: () => null,
    };
    const handlers = createToolHandlers({
      installer: () => installer,
      pick: async () => ({ canceled: true, filePaths: [] }),
      emit: vi.fn(),
      fs: { lstat: async () => ({ isFile: () => true, isSymbolicLink: () => false }) as never },
    });
    await handlers["tools.installFromPath"]({ path: "/tmp/tool.LENSPKG" });
    expect(install).toHaveBeenCalledWith("/tmp/tool.LENSPKG");
  });

  it("rechaza rutas relativas, otros sufijos, directorios y enlaces simbólicos", async () => {
    const install = vi.fn();
    const handlers = createToolHandlers({
      installer: () => ({
        install,
        registry: { list: () => [], setEnabled: () => true },
        confirmDowngrade: vi.fn(),
        remove: vi.fn(),
        getPendingDowngrade: () => null,
      }),
      pick: async () => ({ canceled: true, filePaths: [] }),
      emit: vi.fn(),
      fs: {
        lstat: async (path) =>
          ({
            isFile: () => String(path).includes("dir") === false,
            isSymbolicLink: () => String(path).includes("link"),
          }) as never,
      },
    });
    for (const path of ["relative.lenspkg", "/tmp/no.zip", "/tmp/dir.lenspkg", "/tmp/link.lenspkg"])
      await expect(handlers["tools.installFromPath"]({ path })).rejects.toMatchObject({
        code: "E_INVALID_PARAMS",
      });
    expect(install).not.toHaveBeenCalled();
  });

  it("avisa de un fallo de instalación y lo propaga", async () => {
    const failure = Object.assign(new Error("firma"), { code: "E_SIGNATURE_INVALID" });
    const onInstallFailed = vi.fn();
    const handlers = createToolHandlers({
      installer: () => ({
        install: vi.fn(async () => {
          throw failure;
        }),
        registry: { list: () => [], setEnabled: () => true },
        confirmDowngrade: vi.fn(),
        remove: vi.fn(),
        getPendingDowngrade: () => null,
      }),
      pick: async () => ({ canceled: false, filePaths: ["/tmp/tool.lenspkg"] }),
      emit: vi.fn(),
      onInstallFailed,
    });
    await expect(handlers["tools.pickAndInstall"]()).rejects.toBe(failure);
    expect(onInstallFailed).toHaveBeenCalledWith(failure);
  });
});
