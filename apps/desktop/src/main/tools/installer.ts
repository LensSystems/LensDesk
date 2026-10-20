import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { extractPackage, verifyPackage } from "@lensdesk/lenspkg";
import { LensError } from "@lensdesk/sdk/errors";
import semver from "semver";
import type { SqliteDatabase } from "../db/database.ts";
import { createToolRegistry, type InstalledTool } from "./registry.ts";

type Fs = Pick<
  typeof import("node:fs/promises"),
  "mkdir" | "rename" | "rm" | "stat" | "readdir" | "readFile" | "copyFile" | "chmod"
>;
export function createToolInstaller(options: {
  database: SqliteDatabase;
  userData: string;
  trustedKeys: () => Map<string, string>;
  developerMode: () => boolean;
  hostVersion: string;
  now?: () => string;
  fs?: Fs;
  verify?: typeof verifyPackage;
  extract?: typeof extractPackage;
  onToolRemoved?: (toolId: string) => void;
  // Al actualizar: se avisa antes de borrar la versión anterior para cerrar lo que la usa.
  onToolUpdated?: (toolId: string) => void;
}) {
  const fs = options.fs ?? importFs;
  const verify = options.verify ?? verifyPackage;
  const extract = options.extract ?? extractPackage;
  const registry = createToolRegistry(options.database);
  const toolsRoot = resolve(options.userData, "tools");
  let pendingDowngrade: {
    file: string;
    toolId: string;
    installedVersion: string;
    version: string;
  } | null = null;
  const inside = (path: string): boolean => {
    const rel = relative(toolsRoot, resolve(path));
    return (
      rel === "" ||
      (!rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
        rel !== ".." &&
        !isAbsolute(rel))
    );
  };
  async function install(
    file: string,
    confirmedDowngrade?: { toolId: string; version: string },
  ): Promise<InstalledTool> {
    pendingDowngrade = null;
    await fs.mkdir(toolsRoot, { recursive: true });
    const packageCopy = join(toolsRoot, `.tmp-${randomUUID()}.lenspkg`);
    try {
      await fs.copyFile(file, packageCopy, fsConstants.COPYFILE_EXCL);
      await fs.chmod(packageCopy, 0o600);
      const result = await verify(packageCopy, {
        trustedKeys: options.trustedKeys(),
        allowUntrusted: options.developerMode(),
        hostVersion: options.hostVersion,
      });
      if (!result.ok) throw new LensError(result.code as never, result.message);
      // IDs and versions come only from the verified manifest, never the archive path.
      const { id, version } = result.manifest;
      if (!/^[a-z][a-z0-9-]{1,39}$/.test(id))
        throw new LensError("E_MANIFEST_INVALID", "ID de herramienta inválido.");
      const previous = registry.get(id);
      const confirmed = confirmedDowngrade?.toolId === id && confirmedDowngrade.version === version;
      if (previous && semver.lt(version, previous.version) && !confirmed) {
        pendingDowngrade = { file, toolId: id, installedVersion: previous.version, version };
        throw new LensError(
          "E_DOWNGRADE_CONFIRM",
          "Confirma la instalación de esta versión anterior.",
        );
      }
      const target = resolve(toolsRoot, id, version);
      if (!inside(target) || !inside(dirname(target)))
        throw new LensError("E_MANIFEST_INVALID", "Ruta de instalación inválida.");
      const temporary = join(toolsRoot, `.tmp-${randomUUID()}`);
      const backup = join(toolsRoot, `.old-${randomUUID()}`);
      let movedOld = false;
      let installedNew = false;
      try {
        await fs.mkdir(temporary, { recursive: false });
        await extract(packageCopy, temporary);
        await fs.mkdir(dirname(target), { recursive: true });
        try {
          await fs.rename(target, backup);
          movedOld = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        await fs.rename(temporary, target);
        installedNew = true;
        const now = (options.now ?? (() => new Date().toISOString()))();
        registry.upsert({
          id,
          version,
          manifest: result.manifest as unknown as Record<string, unknown>,
          installPath: target,
          enabled: previous?.enabled ?? true,
          signed: result.signed,
          keyId: result.signed ? result.keyId : null,
          installedAt: previous?.installedAt ?? now,
          updatedAt: now,
        });
        if (previous) options.onToolUpdated?.(id);
        if (movedOld) await fs.rm(backup, { recursive: true, force: true }).catch(() => undefined);
        if (previous && previous.installPath !== target && inside(previous.installPath))
          await fs
            .rm(previous.installPath, { recursive: true, force: true })
            .catch(() => undefined);
        const installed = registry.get(id);
        if (!installed)
          throw new LensError("E_INTERNAL", "No se pudo leer la herramienta instalada.");
        return installed;
      } catch (error) {
        await fs.rm(temporary, { recursive: true, force: true }).catch(() => undefined);
        if (installedNew)
          await fs.rm(target, { recursive: true, force: true }).catch(() => undefined);
        if (movedOld) await fs.rename(backup, target).catch(() => undefined);
        if (!previous)
          await fs.rm(dirname(target), { recursive: true, force: true }).catch(() => undefined);
        throw error;
      }
    } finally {
      await fs.rm(packageCopy, { force: true }).catch(() => undefined);
    }
  }
  return {
    registry,
    install,
    getPendingDowngrade: () =>
      pendingDowngrade
        ? {
            toolId: pendingDowngrade.toolId,
            installedVersion: pendingDowngrade.installedVersion,
            version: pendingDowngrade.version,
          }
        : null,
    async confirmDowngrade(id: string, version: string): Promise<InstalledTool> {
      const entry = pendingDowngrade;
      if (!entry || entry.toolId !== id || entry.version !== version)
        throw new LensError(
          "E_INVALID_PARAMS",
          "No hay una confirmación pendiente para esa versión.",
        );
      pendingDowngrade = null;
      return install(entry.file, { toolId: entry.toolId, version: entry.version });
    },
    async remove(id: string, deleteData: boolean): Promise<void> {
      const tool = registry.get(id);
      if (!tool) throw new LensError("E_TOOL_NOT_FOUND", "Herramienta no encontrada.");
      if (!inside(tool.installPath))
        throw new LensError("E_INVALID_PARAMS", "Ruta instalada inválida.");
      await fs.rm(tool.installPath, { recursive: true, force: true });
      registry.remove(id);
      if (pendingDowngrade?.toolId === id) pendingDowngrade = null;
      options.onToolRemoved?.(id);
      if (deleteData) {
        options.database.prepare("DELETE FROM tool_kv WHERE tool_id = ?").run(id);
        const dataDir = resolve(options.userData, "tool-data", id);
        const dataRel = relative(resolve(options.userData, "tool-data"), dataDir);
        if (dataRel && !dataRel.startsWith("..") && !isAbsolute(dataRel))
          await fs.rm(dataDir, { recursive: true, force: true });
      }
    },
  };
}

import * as importFs from "node:fs/promises";
