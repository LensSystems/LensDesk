import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
import { createSettingsHandlers } from "./context.ts";
import { openHostDatabase, readStoredLocale, supportsFts5 } from "./db/driver.ts";
import { SchemaTooNewError } from "./db/migrate.ts";
import { getSetting, setSetting } from "./db/settings-repo.ts";
import { createTranslator } from "./i18n.ts";
import { createErrorNotifier } from "./log/error-notifier.ts";
import { logProcessErrors, logRendererCrashes } from "./log/wire-logging.ts";
import { buildMenuTemplate } from "./menu.ts";
import { configureRuntime, runSmoke } from "./runtime.ts";
import { createTabHandlers } from "./shell/tab-handlers.ts";
import { createTabsStore } from "./shell/tabs-store.ts";
import { updateTitleBar, wireFullScreen } from "./shell/title-bar.ts";
import { restoreWindowBounds, saveWindowBounds } from "./shell/window-state.ts";
import { createToolWiring } from "./tools/wire-tools.ts";
import {
  createMainLogger,
  createSmokeChecks,
  loadShell,
  probeShell,
  registerHostIpc,
  schemaTooNewDialog,
  shellWindowOptions,
  wireAppServices,
} from "./wire-app.ts";

const packageJson = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8"),
) as { version: string };
const smoke = configureRuntime(process.argv, process.env.LENSDESK_USER_DATA, (path) =>
  app.setPath("userData", path),
);
const { logger, logsDir } = createMainLogger(app.getPath("userData"));
let shellWindow: BrowserWindow | undefined;
let shellContents: Electron.WebContents | undefined;
// Aviso al shell por errores no capturados, como mucho uno cada 10 s y sin detalles.
logProcessErrors(
  process,
  logger,
  createErrorNotifier({
    now: () => Date.now(),
    minIntervalMs: 10_000,
    emit: (payload) => {
      if (shellContents && !shellContents.isDestroyed()) shellContents.send("app.error", payload);
    },
  }),
);
let database: ReturnType<typeof openHostDatabase> | undefined;
const requireDatabase = () => {
  if (!database) throw new LensError("E_INTERNAL", "La base de datos aún no está disponible.");
  return database;
};
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
    get: (key) => getSetting(requireDatabase(), key),
    set: (key, value) => setSetting(requireDatabase(), key, value),
  },
  emit: (event, payload) => {
    if (event === "context.changed") {
      if (shellWindow && !shellWindow.isDestroyed()) {
        updateTitleBar(
          shellWindow,
          process.platform,
          (payload as HostEventPayloads["context.changed"]).theme,
        );
      }
      setNativeMenu((payload as HostEventPayloads["context.changed"]).locale);
      toolWiring?.publishContext(payload as HostEventPayloads["context.changed"]);
    }
    shellContents?.send(event, payload);
  },
  getSystemIsDark: () => nativeTheme.shouldUseDarkColors,
});
const tabsStore = () =>
  createTabsStore(requireDatabase(), (tabs) => shellContents?.send("tabs.changed", { tabs }));
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
const { updates, appActions } = wireAppServices({
  // Sin `lensdesk.releasesRepo` la comprobación se omite siempre y no hay red.
  repo: __RELEASES_REPO__,
  currentVersion: packageJson.version,
  userData: app.getPath("userData"),
  logsDir,
  logger,
  settings: settingsHandlers,
  fetch: (url, init) => fetch(url, init),
  emitUpdate: (payload) => shellContents?.send("update.available", payload),
  showSaveDialog: (options) => {
    const window = BrowserWindow.getFocusedWindow();
    return window ? dialog.showSaveDialog(window, options) : dialog.showSaveDialog(options);
  },
  openPath: (path) => shell.openPath(path),
  openExternal: (url) => shell.openExternal(url),
});
const tabHandlers = createTabHandlers({
  tabsStore,
  follow: followTabs,
  closeTool: (toolId) => toolWiring.close(toolId),
  hideAll: () => toolWiring.hideAll(),
  leaveTab: () => {
    showingTab = false;
  },
});
registerHostIpc(ipcMain, {
  handlers: {
    "app.getInfo": () => ({ version: packageJson.version, platform: process.platform }),
    "settings.get": settingsHandlers["settings.get"],
    "settings.set": settingsHandlers["settings.set"],
    "app.getContext": settingsHandlers["app.getContext"],
    ...tabHandlers,
    ...toolWiring.handlers,
    ...appActions,
  },
  isShellSender: (sender) => shellContents !== undefined && sender === shellContents,
});

void app.whenReady().then(async () => {
  try {
    database = openHostDatabase(app.getPath("userData"));
  } catch (error) {
    if (error instanceof SchemaTooNewError) {
      const t = createTranslator(readStoredLocale(app.getPath("userData")));
      await dialog.showMessageBox(schemaTooNewDialog(t, error));
      app.exit(1);
      return;
    }
    throw error;
  }
  const readyDatabase = database;
  setNativeMenu(getSetting(readyDatabase, "locale"));
  nativeTheme.on("updated", settingsHandlers.emitContextChanged);
  const bounds = restoreWindowBounds(
    database,
    screen.getAllDisplays().map(({ bounds: rect }) => rect),
  );
  const window = new BrowserWindow(
    shellWindowOptions(
      bounds,
      !smoke,
      resolve(import.meta.dirname, "../preload/host.cjs"),
      process.platform,
      settingsHandlers["app.getContext"]().theme,
    ),
  );
  shellWindow = window;
  window.on("resize", showActiveTool);
  followTabs(tabsStore().list());

  shellContents = window.webContents;
  wireFullScreen(window);
  await toolWiring.initialize(readyDatabase, window, process.env.LENSDESK_DEV_TOOLS_DIR);
  window.on("close", () => {
    if (database) saveWindowBounds(database, window.getBounds());
  });
  await loadShell(
    window,
    process.env.ELECTRON_RENDERER_URL,
    resolve(import.meta.dirname, "../renderer/index.html"),
  );

  void updates.run().catch((error: unknown) => logger.warn("update.check", String(error)));

  if (smoke) {
    await runSmoke(
      probeShell,
      window,
      packageJson.version,
      (line) => console.log(line),
      (code) => app.exit(code),
      createSmokeChecks({
        database: () => database,
        supportsFts5,
        forkUtility: () => utilityProcess.fork(resolve(import.meta.dirname, "./smoke-utility.js")),
        toolsReady: () =>
          toolWiring.registry !== undefined && Array.isArray(toolWiring.registry.list()),
      }),
    );
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => toolWiring?.terminateAll());
