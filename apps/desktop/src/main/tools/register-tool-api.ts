import { lstat, stat } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";
import { LensError } from "@lensdesk/sdk/errors";
import type { IpcMain, WebContents } from "electron";
import { TOOL_DROP_REGISTER_CHANNEL, TOOL_IPC_CHANNEL } from "../../shared/tool-channels.ts";
import type { SqliteDatabase } from "../db/database.ts";
import type { FileTokens } from "./file-tokens.ts";

export function createToolDialogs(
  dialog: {
    showOpenDialog(
      parent: unknown,
      options: Electron.OpenDialogOptions,
    ): Promise<{ canceled: boolean; filePaths: string[] }>;
    showSaveDialog(
      parent: unknown,
      options: Electron.SaveDialogOptions,
    ): Promise<{ canceled: boolean; filePath?: string }>;
  },
  parent: unknown,
) {
  return {
    showOpenDialog: (options: unknown) =>
      dialog.showOpenDialog(parent, options as Electron.OpenDialogOptions),
    showSaveDialog: (options: unknown) =>
      dialog.showSaveDialog(parent, options as Electron.SaveDialogOptions),
  };
}

import type { InstalledTool } from "./registry.ts";
import { createToolApi } from "./tool-api.ts";
import type { ToolView } from "./tool-views.ts";

export function registerToolApi(options: {
  ipcMain: Pick<IpcMain, "handle">;
  db: SqliteDatabase;
  registry: { get(id: string): InstalledTool | undefined };
  views: { getToolIdForContents(id: number): string | undefined; getViews(): ToolView[] };
  context: () => { locale: string; theme: string; accent?: "blue" | "green" };
  hostVersion: string;
  shellContents: () => WebContents | undefined;
  clipboard: (text: string) => void;
  openExternal: (url: string) => Promise<void>;
  fileTokens: FileTokens;
  dialog: Parameters<typeof createToolApi>[0]["dialog"];
  backend?: Parameters<typeof createToolApi>[0]["backend"];
}) {
  const api = createToolApi({
    db: options.db,
    registry: options.registry,
    views: options.views.getViews,
    viewId: options.views.getToolIdForContents,
    context: options.context,
    hostVersion: options.hostVersion,
    clipboard: options.clipboard,
    openExternal: options.openExternal,
    fileTokens: options.fileTokens,
    dialog: options.dialog,
    backend: options.backend,
    log: (toolId, toast) => options.shellContents()?.send("tools.toast", { toolId, ...toast }),
  });
  options.ipcMain.handle(TOOL_IPC_CHANNEL, (event, channel: string, payload: unknown) =>
    api.invoke(event.sender, channel, payload),
  );
  options.ipcMain.handle(TOOL_DROP_REGISTER_CHANNEL, async (event, paths: unknown) => {
    const id = options.views.getToolIdForContents(event.sender.id);
    const tool = id ? options.registry.get(id) : undefined;
    if (!id || !tool?.enabled || !Array.isArray(paths))
      throw new LensError("E_PERMISSION_DENIED", "Emisor no autorizado.");
    if (!Array.isArray(tool.manifest.permissions) || !tool.manifest.permissions.includes("files"))
      throw new LensError("E_PERMISSION_DENIED", "Permiso no concedido.");
    const files = await Promise.all(
      paths.map(async (path) => {
        if (typeof path !== "string" || !isAbsolute(path))
          throw new LensError("E_PATH_NOT_GRANTED", "El archivo no está autorizado.");
        const info = await lstat(path);
        if (!info.isFile() || !(await stat(path)).isFile())
          throw new LensError("E_PATH_NOT_GRANTED", "El archivo no está autorizado.");
        return {
          token: options.fileTokens.grant(id, path, "read"),
          name: basename(path),
          size: info.size,
        };
      }),
    );
    event.sender.send("lensdesk:tool-event:files.drop", files);
    return undefined;
  });
  return api;
}
