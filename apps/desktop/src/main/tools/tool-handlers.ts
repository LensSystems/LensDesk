import { lstat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { LensError } from "@lensdesk/sdk/errors";

type Fs = Pick<typeof import("node:fs/promises"), "lstat">;
type Installer = {
  registry: {
    list: () => Array<{ installPath: string; [key: string]: unknown }>;
    setEnabled: (id: string, enabled: boolean, now: string) => boolean;
  };
  install: (path: string) => Promise<unknown>;
  confirmDowngrade: (id: string, version: string) => Promise<unknown>;
  remove: (id: string, deleteData: boolean) => Promise<void>;
  getPendingDowngrade: () => { toolId: string; installedVersion: string; version: string } | null;
};
export function createToolHandlers(options: {
  installer: () => Installer | undefined;
  pick: () => Promise<{ canceled: boolean; filePaths: string[] }>;
  emit: () => void;
  fs?: Fs;
}) {
  const fs = options.fs ?? { lstat };
  const state = () => {
    const installer = options.installer();
    return {
      tools: (installer?.registry.list() ?? []).map(({ installPath: _path, ...tool }) => tool),
      pendingDowngrade: installer?.getPendingDowngrade() ?? null,
    };
  };
  const install = async (path: string) => {
    const installer = options.installer();
    if (!installer) throw new LensError("E_INTERNAL", "El instalador no está disponible.");
    try {
      await installer.install(path);
    } finally {
      options.emit();
    }
  };
  return {
    "tools.list": () => state(),
    "tools.pickAndInstall": async () => {
      const picked = await options.pick();
      if (!picked.canceled && picked.filePaths[0]) await install(picked.filePaths[0]);
      return state();
    },
    "tools.installFromPath": async ({ path }: { path: string }) => {
      if (!isAbsolute(path) || !path.toLowerCase().endsWith(".lenspkg"))
        throw new LensError("E_INVALID_PARAMS", "La ruta debe ser un archivo .lenspkg absoluto.");
      let info: Awaited<ReturnType<Fs["lstat"]>>;
      try {
        info = await fs.lstat(path);
      } catch {
        throw new LensError("E_INVALID_PARAMS", "El archivo .lenspkg no existe.");
      }
      if (!info.isFile() || info.isSymbolicLink())
        throw new LensError("E_INVALID_PARAMS", "La ruta debe ser un archivo .lenspkg regular.");
      await install(path);
      return state();
    },
    "tools.confirmDowngrade": async ({ toolId, version }: { toolId: string; version: string }) => {
      const installer = options.installer();
      if (!installer) throw new LensError("E_INTERNAL", "El instalador no está disponible.");
      try {
        await installer.confirmDowngrade(toolId, version);
      } finally {
        options.emit();
      }
      return state();
    },
    "tools.setEnabled": ({ toolId, enabled }: { toolId: string; enabled: boolean }) => {
      const installer = options.installer();
      if (!installer) throw new LensError("E_INTERNAL", "El registro no está disponible.");
      if (!installer.registry.setEnabled(toolId, enabled, new Date().toISOString()))
        throw new LensError("E_TOOL_NOT_FOUND", "Herramienta no encontrada.");
      options.emit();
      return state();
    },
    "tools.remove": async ({ toolId, deleteData }: { toolId: string; deleteData: boolean }) => {
      const installer = options.installer();
      if (!installer) throw new LensError("E_INTERNAL", "El instalador no está disponible.");
      try {
        await installer.remove(toolId, deleteData);
      } finally {
        options.emit();
      }
      return state();
    },
  };
}
