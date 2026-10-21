import { join } from "node:path";
import { HOST_IPC_CHANNEL } from "../shared/host-channels.ts";
import { HEADER_HEIGHT, MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH } from "../shared/layout.ts";
import { createAppActions, createLoginSettingsActions } from "./app-actions.ts";
import type { createSettingsHandlers, ResolvedTheme } from "./context.ts";
import type { SqliteDatabase } from "./db/database.ts";
import { createRouter } from "./ipc/router.ts";
import { ipcSchemas } from "./ipc/schemas.ts";
import { exportLogs } from "./log/export.ts";
import { createLogger, type Logger } from "./log/logger.ts";
import { createLoginItem, type LoginItemDependencies } from "./login-item.ts";
import { titleBarColors, titleBarOverlayFor } from "./shell/title-bar.ts";
import { createUpdateService } from "./updates/update-service.ts";

type SettingsHandlers = Pick<
  ReturnType<typeof createSettingsHandlers>,
  "settings.get" | "settings.set"
>;

// Une las actualizaciones y las acciones del shell con sus ajustes y registros. Las piezas de
// Electron (diálogo, `shell`, `fetch`) llegan por parámetro desde `index.ts`.
export function wireAppServices(options: {
  loginItem: LoginItemDependencies;
  // Sin `lensdesk.releasesRepo` la comprobación se omite siempre y no hay red.
  repo: string;
  currentVersion: string;
  userData: string;
  logsDir: string;
  logger: Logger;
  settings: SettingsHandlers;
  fetch: Parameters<typeof createUpdateService>[0]["fetch"];
  platform?: string;
  arch?: string;
  installedTools?: Parameters<typeof createUpdateService>[0]["installedTools"];
  emitTools?: Parameters<typeof createUpdateService>[0]["emitTools"];
  emitUpdate: Parameters<typeof createUpdateService>[0]["emit"];
  showSaveDialog(options: {
    defaultPath: string;
    filters: { name: string; extensions: string[] }[];
  }): Promise<{ canceled: boolean; filePath?: string }>;
  openPath(path: string): Promise<string>;
  openExternal(url: string): Promise<void>;
}) {
  const { settings, logger } = options;
  const updates = createUpdateService({
    repo: options.repo,
    platform: options.platform,
    arch: options.arch,
    installedTools: options.installedTools,
    emitTools: options.emitTools,
    currentVersion: options.currentVersion,
    fetch: options.fetch,
    now: () => new Date(),
    settings: {
      enabled: () => settings["settings.get"]({ key: "updates.check" }).value === true,
      lastCheckedAt: () =>
        settings["settings.get"]({ key: "updates.lastCheckedAt" }).value as string | null,
      setLastCheckedAt: (value) =>
        settings["settings.set"]({ key: "updates.lastCheckedAt", value }),
    },
    emit: options.emitUpdate,
    log: (message) => logger.warn("update.check", message),
  });
  const appActions = createAppActions({
    userData: options.userData,
    logsDir: options.logsDir,
    now: () => new Date(),
    pickSavePath: async (defaultName) => {
      const picked = await options.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: "Zip", extensions: ["zip"] }],
      });
      return picked.canceled ? undefined : picked.filePath;
    },
    exportLogs,
    openPath: options.openPath,
    openExternal: options.openExternal,
    checkNow: () => updates.run(true),
    log: (event, message) => logger.error(event, message),
  });
  return {
    updates,
    appActions: {
      ...appActions,
      ...createLoginSettingsActions(settings, createLoginItem(options.loginItem)),
    },
  };
}

type UtilityLike = {
  once(event: "message", listener: (message: unknown) => void): unknown;
  once(event: "exit", listener: (code: number | null) => void): unknown;
  kill(): unknown;
};

// Comprobaciones de `pnpm smoke`: la base tiene el esquema, FTS5 existe en main y en un proceso
// utilitario, y el registro de herramientas responde.
export function createSmokeChecks(options: {
  database: () => SqliteDatabase | undefined;
  supportsFts5(): boolean;
  forkUtility(): UtilityLike;
  toolsReady(): boolean;
}) {
  return {
    database: () => {
      const database = options.database();
      if (!database) return false;
      const tables = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as { name: string }[];
      return ["schema_migrations", "settings", "installed_tools", "open_tabs", "tool_kv"].every(
        (name) => tables.some((table) => table.name === name),
      );
    },
    ftsMain: options.supportsFts5,
    ftsUtility: () =>
      new Promise<boolean>((resolveSmoke) => {
        const utility = options.forkUtility();
        utility.once("message", (message) => {
          utility.kill();
          resolveSmoke(
            typeof message === "object" &&
              message !== null &&
              "fts5" in message &&
              message.fts5 === true,
          );
        });
        utility.once("exit", (code) => {
          if (code !== 0) resolveSmoke(false);
        });
      }),
    tools: options.toolsReady,
  };
}

// Comprueba que el preload del shell expuso `window.lensdeskHost`.
export async function probeShell(target: {
  webContents: { executeJavaScript(code: string): Promise<unknown> };
}): Promise<boolean> {
  return (
    (await target.webContents.executeJavaScript("typeof window.lensdeskHost !== 'undefined'")) ===
    true
  );
}

// Diálogo de error cuando la base es de una versión más nueva que la app.
export function schemaTooNewDialog(
  t: (key: string, params?: Record<string, string | number>) => string,
  error: { version: number; latest: number },
) {
  return {
    type: "error" as const,
    message: t("schemaTooNew.message"),
    detail: t("schemaTooNew.detail", { version: error.version, latest: error.latest }),
  };
}

// Opciones de la ventana del shell: aislada, con sandbox y sin Node.
export function shellWindowOptions(
  bounds: { width?: number; height?: number },
  show: boolean,
  preload: string,
  platform: string,
  theme: ResolvedTheme,
) {
  const titleOptions =
    platform === "darwin"
      ? {
          titleBarStyle: "hiddenInset" as const,
          // Los semáforos miden 14 px de alto: (52 - 14) / 2 = 19 px.
          trafficLightPosition: { x: 16, y: (HEADER_HEIGHT - 14) / 2 },
          backgroundColor: titleBarColors[theme].color,
        }
      : platform === "win32"
        ? {
            titleBarStyle: "hidden" as const,
            titleBarOverlay: titleBarOverlayFor(theme),
            backgroundColor: titleBarColors[theme].color,
          }
        : {};
  return {
    ...bounds,
    ...titleOptions,
    // Si el área de trabajo es menor que el mínimo, el mínimo baja al tamaño restaurado.
    minWidth: Math.min(MIN_WINDOW_WIDTH, bounds.width ?? MIN_WINDOW_WIDTH),
    minHeight: Math.min(MIN_WINDOW_HEIGHT, bounds.height ?? MIN_WINDOW_HEIGHT),
    show,
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  };
}

// Registra el único canal IPC del shell: todo pasa por el router, que valida cada payload.
export function registerHostIpc(
  ipcMain: Pick<Electron.IpcMain, "handle">,
  options: Pick<
    Parameters<typeof createRouter<typeof ipcSchemas>>[0],
    "handlers" | "isShellSender"
  >,
): void {
  const router = createRouter({ schemas: ipcSchemas, ...options });
  ipcMain.handle(HOST_IPC_CHANNEL, (event, channel: string, payload: unknown) =>
    router(event.sender, channel, payload),
  );
}

// Bloquea navegación y ventanas nuevas del shell y carga su página (la URL solo existe en
// desarrollo; empaquetada se carga el archivo local).
export async function loadShell(
  window: {
    webContents: {
      on(event: "will-navigate", listener: (event: { preventDefault(): void }) => void): unknown;
      setWindowOpenHandler(handler: () => { action: "deny" }): unknown;
    };
    loadURL(url: string): Promise<unknown>;
    loadFile(path: string): Promise<unknown>;
  },
  devUrl: string | undefined,
  file: string,
): Promise<void> {
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  if (devUrl) await window.loadURL(devUrl);
  else await window.loadFile(file);
}

// Registros locales en <userData>/logs: 1 MB por archivo y 5 archivos como máximo.
export function createMainLogger(userData: string) {
  const logsDir = join(userData, "logs");
  const logger = createLogger({
    dir: logsDir,
    maxBytes: 1024 * 1024,
    maxFiles: 5,
    now: () => new Date(),
  });
  return { logger, logsDir };
}
