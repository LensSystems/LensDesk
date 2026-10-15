import type { IpcMain, WebContents } from "electron";
import { TOOL_IPC_CHANNEL } from "../../shared/tool-channels.ts";
import type { SqliteDatabase } from "../db/database.ts";
import type { InstalledTool } from "./registry.ts";
import { createToolApi } from "./tool-api.ts";
import type { ToolView } from "./tool-views.ts";

export function registerToolApi(options: {
  ipcMain: Pick<IpcMain, "handle">;
  db: SqliteDatabase;
  registry: { get(id: string): InstalledTool | undefined };
  views: { getToolIdForContents(id: number): string | undefined; getViews(): ToolView[] };
  context: () => { locale: string; theme: string };
  hostVersion: string;
  shellContents: () => WebContents | undefined;
  clipboard: (text: string) => void;
  openExternal: (url: string) => Promise<void>;
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
    log: (toolId, toast) => options.shellContents()?.send("tools.toast", { toolId, ...toast }),
  });
  options.ipcMain.handle(TOOL_IPC_CHANNEL, (event, channel: string, payload: unknown) =>
    api.invoke(event.sender, channel, payload),
  );
  return api;
}
