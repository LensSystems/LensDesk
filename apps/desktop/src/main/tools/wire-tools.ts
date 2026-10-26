import { lstat, readFile, stat, writeFile } from "node:fs/promises";
import { LensError } from "@lensdesk/sdk/errors";
import { clipboard, dialog, ipcMain } from "electron";
import type { SqliteDatabase } from "../db/database.ts";
import { getSetting } from "../db/settings-repo.ts";
import type { Logger } from "../log/logger.ts";
import {
  logBackendExit,
  logBackendMessage,
  logFileDenied,
  logInstallFailure,
} from "../log/wire-logging.ts";
import { createTabsStore } from "../shell/tabs-store.ts";
import { spellcheckEnabled } from "../spellcheck.ts";
import { createBackendHost } from "./backend-host.ts";
import { scanDevTools } from "./dev-tools.ts";
import { createFileTokens } from "./file-tokens.ts";
import { createToolInstaller } from "./installer.ts";
import { registerToolProtocol } from "./protocol.ts";
import { createToolDialogs, registerToolApi } from "./register-tool-api.ts";
import { publishTabsChanged } from "./tool-events.ts";
import { createToolHandlers } from "./tool-handlers.ts";
import { createToolViews, type ViewHost } from "./tool-views.ts";
import { loadTrustedKeys, trustedKeysDirectory } from "./trusted-keys.ts";

export function createToolWiring(options: {
  app: Electron.App;
  database: () => SqliteDatabase | undefined;
  userData: string;
  version: string;
  shellContents: () => Electron.WebContents | undefined;
  context: () => { locale: string; theme: string; accent?: "blue" | "green" };
  showingTab: () => boolean;
  onShowActiveTool(callback: () => void): void;
  // Herramientas o pestañas cambiaron fuera del almacén de pestañas (instalar, quitar).
  onCatalogChanged?: () => void;
  logger: Logger;
}) {
  const fileTokens = createFileTokens({
    log: (toolId, channel) => logFileDenied(options.logger, toolId, channel),
  });
  let installer: ReturnType<typeof createToolInstaller> | undefined;
  let views: ReturnType<typeof createToolViews> | undefined;
  let api: ReturnType<typeof registerToolApi> | undefined;
  let window: Electron.BrowserWindow | undefined;
  const backend = createBackendHost({
    userData: options.userData,
    hostVersion: options.version,
    getTool: (id) => installer?.registry.get(id),
    log: (toolId, level, message) => logBackendMessage(options.logger, toolId, level, message),
    onExit: (toolId, code, expected) => logBackendExit(options.logger, toolId, code, expected),
    resolveFile: async (toolId, op, token, bytes) => {
      if (op === "readBytes") {
        const path = fileTokens.resolve(toolId, token, "read", "backend.files.readBytes");
        const info = await lstat(path);
        if (!info.isFile() || !(await stat(path)).isFile())
          throw new LensError("E_PATH_NOT_GRANTED", "El archivo no está autorizado.");
        if (info.size > 50 * 1024 * 1024)
          throw new LensError("E_TOO_LARGE", "El archivo supera 50 MB.");
        return new Uint8Array(await readFile(path));
      }
      if (op === "writeBytes" && bytes) {
        if (bytes.byteLength > 50 * 1024 * 1024)
          throw new LensError("E_TOO_LARGE", "El archivo supera 50 MB.");
        const path = fileTokens.resolve(toolId, token, "write", "backend.files.writeBytes");
        await writeFile(path, bytes);
        return;
      }
      throw new LensError("E_INVALID_PARAMS", "Operación de archivo inválida.");
    },
  });
  const showActive = () => {
    const db = options.database();
    if (!views || !window || !db) return;
    if (!options.showingTab()) {
      views.hideAll();
      return;
    }
    const active = createTabsStore(db, () => undefined)
      .list()
      .find((tab) => tab.active);
    if (active) views.show(active.toolId, window.getContentBounds());
    else views.hideAll();
  };
  options.onShowActiveTool(showActive);
  const handlers = createToolHandlers({
    installer: () => installer,
    onToolDisabled: (id) => {
      backend.terminate(id);
      fileTokens.revoke(id);
      views?.close(id);
    },
    onToolEnabled: showActive,
    onInstallFailed: (error) => logInstallFailure(options.logger, error),
    pick: () =>
      dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "LensDesk Tool", extensions: ["lenspkg"] }],
      }),
    emit: () => {
      options.shellContents()?.send("tools.changed", {
        tools: installer?.registry.list().map(({ installPath: _path, ...tool }) => tool) ?? [],
        pendingDowngrade: installer?.getPendingDowngrade() ?? null,
      });
      options.onCatalogChanged?.();
    },
  });
  return {
    handlers,
    async initialize(
      db: SqliteDatabase,
      targetWindow: Electron.BrowserWindow,
      developerToolsDirectory: string | undefined,
    ) {
      window = targetWindow;
      const keysDirectory = trustedKeysDirectory({
        isPackaged: options.app.isPackaged,
        resourcesPath: process.resourcesPath,
        mainDirectory: import.meta.dirname,
      });
      installer = createToolInstaller({
        database: db,
        userData: options.userData,
        onToolUpdated: (id) => {
          // La pestaña abierta vuelve a cargarse con la versión nueva.
          backend.terminate(id);
          fileTokens.revoke(id);
          views?.close(id);
          showActive();
        },
        onToolRemoved: (id) => {
          backend.terminate(id);
          fileTokens.revoke(id);
          views?.close(id);
          publishTabsChanged(
            () => createTabsStore(db, () => undefined).list(),
            (tabs) => options.shellContents()?.send("tabs.changed", { tabs }),
          );
          options.onCatalogChanged?.();
          showActive();
        },
        trustedKeys: () =>
          loadTrustedKeys({
            directory: keysDirectory,
            developerMode: getSetting(db, "developerMode"),
          }),
        developerMode: () => getSetting(db, "developerMode"),
        hostVersion: options.version,
      });
      await scanDevTools({
        directory: developerToolsDirectory,
        isPackaged: options.app.isPackaged,
        registry: installer.registry,
      });
      registerToolProtocol(installer.registry);
      views = createToolViews({
        host: targetWindow.contentView as unknown as ViewHost,
        registry: installer.registry,
      });
      api = registerToolApi({
        ipcMain,
        db,
        registry: installer.registry,
        views,
        context: options.context,
        spellcheck: spellcheckEnabled(process.platform),
        hostVersion: options.version,
        shellContents: options.shellContents,
        clipboard: (text) => clipboard.writeText(text),
        openExternal: (url) => import("electron").then(({ shell }) => shell.openExternal(url)),
        fileTokens,
        dialog: createToolDialogs(dialog, targetWindow),
        backend,
      });
      showActive();
      return api;
    },
    publishContext(context: { locale: string; theme: string; accent?: "blue" | "green" }) {
      api?.publishContext(context);
    },
    close(toolId: string) {
      views?.close(toolId);
      backend.terminate(toolId);
    },
    hideAll() {
      views?.hideAll();
    },
    showActive,
    toolIdForContents(id: number) {
      return views?.getToolIdForContents(id);
    },
    terminateAll() {
      backend.terminateAll();
    },
    get registry() {
      return installer?.registry;
    },
    get installer() {
      return installer;
    },
  };
}
