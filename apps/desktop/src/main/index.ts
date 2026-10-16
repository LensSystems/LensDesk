import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LensError } from "@lensdesk/sdk/errors";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  screen,
  shell,
  utilityProcess,
} from "electron";
import type { HostEventPayloads } from "../shared/host-channels.ts";
import { HOST_IPC_CHANNEL } from "../shared/host-channels.ts";
import { createAppActions } from "./app-actions.ts";
import { createSettingsHandlers } from "./context.ts";
import { openHostDatabase, readStoredLocale, supportsFts5 } from "./db/driver.ts";
import { SchemaTooNewError } from "./db/migrate.ts";
import { getSetting, setSetting } from "./db/settings-repo.ts";
import { createTranslator } from "./i18n.ts";
import { createRouter } from "./ipc/router.ts";
import { ipcSchemas } from "./ipc/schemas.ts";
import { exportLogs } from "./log/export.ts";
import { createLogger } from "./log/logger.ts";
import { logProcessErrors, logRendererCrashes } from "./log/wire-logging.ts";
import { buildMenuTemplate } from "./menu.ts";
import { configureRuntime, runSmoke } from "./runtime.ts";
import { createTabsStore } from "./shell/tabs-store.ts";
import { restoreWindowBounds, saveWindowBounds } from "./shell/window-state.ts";
import { createToolWiring } from "./tools/wire-tools.ts";
import { createUpdateService } from "./updates/update-service.ts";

const packageJson = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8"),
) as { version: string };
const smoke = configureRuntime(process.argv, process.env.LENSDESK_USER_DATA, (path) =>
  app.setPath("userData", path),
);
// Registros locales en <userData>/logs: 1 MB por archivo y 5 archivos como máximo.
const logsDir = join(app.getPath("userData"), "logs");
const logger = createLogger({
  dir: logsDir,
  maxBytes: 1024 * 1024,
  maxFiles: 5,
  now: () => new Date(),
});
logProcessErrors(process, logger);
let shellContents: Electron.WebContents | undefined;
let database: ReturnType<typeof openHostDatabase> | undefined;
let activeLocale: "es" | "en" = "es";
// La vista de la herramienta activa solo se muestra cuando el shell está en una pestaña, no en
// Herramientas ni en Ajustes. Sigue la misma regla que el store del shell: hay página de pestaña
// mientras exista una pestaña activa, salvo que el shell pida otra página.
let showingTab = false;
const followTabs = (tabs: { active: boolean }[]): void => {
  showingTab = tabs.some((tab) => tab.active);
  showActiveTool();
};
let showActiveTool = (): void => undefined;
let toolWiring: ReturnType<typeof createToolWiring>;
const setNativeMenu = (locale: "es" | "en"): void => {
  const t = createTranslator(locale);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildMenuTemplate(t, process.platform) as Electron.MenuItemConstructorOptions[],
    ),
  );
};
const settingsHandlers = createSettingsHandlers({
  repo: {
    get: (key) => {
      if (!database) throw new LensError("E_INTERNAL", "La base de datos aún no está disponible.");
      return getSetting(database, key);
    },
    set: (key, value) => {
      if (!database) throw new LensError("E_INTERNAL", "La base de datos aún no está disponible.");
      setSetting(database, key, value);
    },
  },
  emit: (event, payload) => {
    if (event === "context.changed") {
      activeLocale = (payload as HostEventPayloads["context.changed"]).locale;
      setNativeMenu(activeLocale);
      toolWiring?.publishContext(payload as HostEventPayloads["context.changed"]);
    }
    shellContents?.send(event, payload);
  },
  getSystemIsDark: () => nativeTheme.shouldUseDarkColors,
});
const tabsStore = () => {
  if (!database) throw new LensError("E_INTERNAL", "La base de datos aún no está disponible.");
  return createTabsStore(database, (tabs) => shellContents?.send("tabs.changed", { tabs }));
};
toolWiring = createToolWiring({
  app,
  database: () => database,
  userData: app.getPath("userData"),
  version: packageJson.version,
  shellContents: () => shellContents,
  context: () => settingsHandlers["app.getContext"]() as { locale: string; theme: string },
  showingTab: () => showingTab,
  onShowActiveTool: (callback) => {
    showActiveTool = callback;
  },
  logger,
});
logRendererCrashes(app as never, {
  logger,
  toolIdForContents: (id) => toolWiring.toolIdForContents(id),
  // La vista caída taparía la pantalla de recuperación del shell: se cierra antes de avisar.
  onToolCrashed: (toolId) => {
    toolWiring.close(toolId);
    shellContents?.send("tool.crashed", { toolId });
  },
});
// Sin `lensdesk.releasesRepo` (hoy vacío) la comprobación se omite siempre y no hay red.
const updates = createUpdateService({
  repo: __RELEASES_REPO__,
  currentVersion: packageJson.version,
  fetch: (url, init) => fetch(url, init),
  now: () => new Date(),
  settings: {
    enabled: () => settingsHandlers["settings.get"]({ key: "updates.check" }).value === true,
    lastCheckedAt: () =>
      settingsHandlers["settings.get"]({ key: "updates.lastCheckedAt" }).value as string | null,
    setLastCheckedAt: (value) =>
      settingsHandlers["settings.set"]({ key: "updates.lastCheckedAt", value }),
  },
  emit: (payload) => shellContents?.send("update.available", payload),
  log: (message) => logger.warn("update.check", message),
});
const appActions = createAppActions({
  userData: app.getPath("userData"),
  logsDir,
  now: () => new Date(),
  pickSavePath: async (defaultName) => {
    const options = {
      defaultPath: defaultName,
      filters: [{ name: "Zip", extensions: ["zip"] }],
    };
    const window = BrowserWindow.getFocusedWindow();
    const picked = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options);
    return picked.canceled ? undefined : picked.filePath;
  },
  exportLogs,
  openPath: (path) => shell.openPath(path),
  openExternal: (url) => shell.openExternal(url),
  checkNow: () => updates.run(true),
  log: (event, message) => logger.error(event, message),
});
const router = createRouter({
  schemas: ipcSchemas,
  handlers: {
    "app.getInfo": () => ({ version: packageJson.version, platform: process.platform }),
    "settings.get": settingsHandlers["settings.get"],
    "settings.set": settingsHandlers["settings.set"],
    "app.getContext": settingsHandlers["app.getContext"],
    "tabs.list": () => ({ tabs: tabsStore().list() }),
    "tabs.open": ({ toolId }) => {
      const tabs = tabsStore().open(toolId);
      followTabs(tabs);
      return { tabs };
    },
    "tabs.close": ({ toolId }) => {
      const tabs = tabsStore().close(toolId);
      toolWiring.close(toolId);
      followTabs(tabs);
      return { tabs };
    },
    "tabs.activate": ({ toolId }) => {
      const tabs = tabsStore().activate(toolId);
      followTabs(tabs);
      return { tabs };
    },
    "shell.showPage": ({ page }) => {
      showingTab = false;
      toolWiring.hideAll();
      return { page };
    },
    ...toolWiring.handlers,
    ...appActions,
  },
  isShellSender: (sender) => shellContents !== undefined && sender === shellContents,
});

ipcMain.handle(HOST_IPC_CHANNEL, (event, channel: string, payload: unknown) =>
  router(event.sender, channel, payload),
);

void app.whenReady().then(async () => {
  try {
    database = openHostDatabase(app.getPath("userData"));
  } catch (error) {
    if (error instanceof SchemaTooNewError) {
      const t = createTranslator(readStoredLocale(app.getPath("userData")));
      await dialog.showMessageBox({
        type: "error",
        message: t("schemaTooNew.message"),
        detail: t("schemaTooNew.detail", { version: error.version, latest: error.latest }),
      });
      app.exit(1);
      return;
    }
    throw error;
  }
  activeLocale = getSetting(database, "locale");
  const readyDatabase = database;
  setNativeMenu(activeLocale);
  nativeTheme.on("updated", settingsHandlers.emitContextChanged);
  const bounds = restoreWindowBounds(
    database,
    screen.getAllDisplays().map(({ bounds: rect }) => rect),
  );
  const window = new BrowserWindow({
    ...bounds,
    show: !smoke,
    webPreferences: {
      preload: resolve(import.meta.dirname, "../preload/host.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  window.on("resize", showActiveTool);
  followTabs(tabsStore().list());

  shellContents = window.webContents;
  await toolWiring.initialize(readyDatabase, window, process.env.LENSDESK_DEV_TOOLS_DIR);
  window.on("close", () => {
    if (database) saveWindowBounds(database, window.getBounds());
  });
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(resolve(import.meta.dirname, "../renderer/index.html"));
  }

  void updates.run().catch((error: unknown) => logger.warn("update.check", String(error)));

  if (smoke) {
    await runSmoke(
      async (target) =>
        (await target.webContents.executeJavaScript(
          "typeof window.lensdeskHost !== 'undefined'",
        )) === true,
      window,
      packageJson.version,
      (line) => console.log(line),
      (code) => app.exit(code),
      {
        database: () => {
          if (!database) return false;
          const tables = database
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all() as { name: string }[];
          return ["schema_migrations", "settings", "installed_tools", "open_tabs", "tool_kv"].every(
            (name) => tables.some((table) => table.name === name),
          );
        },
        ftsMain: supportsFts5,
        ftsUtility: () =>
          new Promise((resolveSmoke) => {
            const utility = utilityProcess.fork(resolve(import.meta.dirname, "./smoke-utility.js"));
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
        tools: () => toolWiring.registry !== undefined && Array.isArray(toolWiring.registry.list()),
      },
    );
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => toolWiring?.terminateAll());
