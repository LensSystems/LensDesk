import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { LensError } from "@lensdesk/sdk/errors";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  screen,
  utilityProcess,
} from "electron";
import type { HostEventPayloads } from "../shared/host-channels.ts";
import { HOST_IPC_CHANNEL } from "../shared/host-channels.ts";
import { createSettingsHandlers } from "./context.ts";
import { openHostDatabase, readStoredLocale, supportsFts5 } from "./db/driver.ts";
import { SchemaTooNewError } from "./db/migrate.ts";
import { getSetting, setSetting } from "./db/settings-repo.ts";
import { createTranslator } from "./i18n.ts";
import { createRouter } from "./ipc/router.ts";
import { ipcSchemas } from "./ipc/schemas.ts";
import { buildMenuTemplate } from "./menu.ts";
import { configureRuntime, runSmoke } from "./runtime.ts";
import { createTabsStore } from "./shell/tabs-store.ts";
import { restoreWindowBounds, saveWindowBounds } from "./shell/window-state.ts";
import { scanDevTools } from "./tools/dev-tools.ts";
import { createToolInstaller } from "./tools/installer.ts";
import { publishTabsChanged } from "./tools/tool-events.ts";
import { loadTrustedKeys } from "./tools/trusted-keys.ts";

const packageJson = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8"),
) as { version: string };
const smoke = configureRuntime(process.argv, process.env.LENSDESK_USER_DATA, (path) =>
  app.setPath("userData", path),
);
let shellContents: Electron.WebContents | undefined;
let database: ReturnType<typeof openHostDatabase> | undefined;
let activeLocale: "es" | "en" = "es";
let toolInstaller: ReturnType<typeof createToolInstaller> | undefined;
const toolSummaries = () =>
  (toolInstaller?.registry.list() ?? []).map(({ installPath: _path, ...tool }) => tool);
const toolState = () => ({
  tools: toolSummaries(),
  pendingDowngrade: toolInstaller?.getPendingDowngrade() ?? null,
});
const emitToolsChanged = () => shellContents?.send("tools.changed", toolState());
const installTool = async (path: string) => {
  if (!toolInstaller) throw new LensError("E_INTERNAL", "El instalador no está disponible.");
  try {
    await toolInstaller.install(path);
  } catch (error) {
    emitToolsChanged();
    throw error;
  }
  emitToolsChanged();
};
const developerModeEnabled = () => {
  if (!database) throw new LensError("E_INTERNAL", "La base de datos aún no está disponible.");
  return getSetting(database, "developerMode");
};
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
    }
    shellContents?.send(event, payload);
  },
  getSystemIsDark: () => nativeTheme.shouldUseDarkColors,
});
const tabsStore = () => {
  if (!database) throw new LensError("E_INTERNAL", "La base de datos aún no está disponible.");
  return createTabsStore(database, (tabs) => shellContents?.send("tabs.changed", { tabs }));
};
const router = createRouter({
  schemas: ipcSchemas,
  handlers: {
    "app.getInfo": () => ({ version: packageJson.version, platform: process.platform }),
    "settings.get": settingsHandlers["settings.get"],
    "settings.set": settingsHandlers["settings.set"],
    "app.getContext": settingsHandlers["app.getContext"],
    "tabs.list": () => ({ tabs: tabsStore().list() }),
    "tabs.open": ({ toolId }) => ({ tabs: tabsStore().open(toolId) }),
    "tabs.close": ({ toolId }) => ({ tabs: tabsStore().close(toolId) }),
    "tabs.activate": ({ toolId }) => ({ tabs: tabsStore().activate(toolId) }),
    "shell.showPage": ({ page }) => ({ page }),
    "tools.list": () => toolState(),
    "tools.pickAndInstall": async () => {
      if (!toolInstaller) throw new LensError("E_INTERNAL", "El instalador no está disponible.");
      const picked = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "LensDesk Tool", extensions: ["lenspkg"] }],
      });
      if (!picked.canceled && picked.filePaths[0]) await installTool(picked.filePaths[0]);
      return toolState();
    },
    "tools.installFromPath": async ({ path }) => {
      const root = process.env.LENSDESK_DEV_TOOLS_DIR;
      if (app.isPackaged || !root || !developerModeEnabled())
        throw new LensError(
          "E_PERMISSION_DENIED",
          "La instalación por ruta solo está disponible para herramientas de desarrollo.",
        );
      const allowed = resolve(root);
      const candidate = resolve(path);
      const rel = relative(allowed, candidate);
      if (
        rel === ".." ||
        rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
        isAbsolute(rel)
      )
        throw new LensError(
          "E_PERMISSION_DENIED",
          "La ruta debe estar dentro de LENSDESK_DEV_TOOLS_DIR.",
        );
      await installTool(candidate);
      return toolState();
    },
    "tools.confirmDowngrade": async ({ toolId, version }) => {
      if (!toolInstaller) throw new LensError("E_INTERNAL", "El instalador no está disponible.");
      try {
        await toolInstaller.confirmDowngrade(toolId, version);
      } finally {
        emitToolsChanged();
      }
      return toolState();
    },
    "tools.setEnabled": ({ toolId, enabled }) => {
      if (!toolInstaller) throw new LensError("E_INTERNAL", "El registro no está disponible.");
      if (!toolInstaller.registry.setEnabled(toolId, enabled, new Date().toISOString()))
        throw new LensError("E_TOOL_NOT_FOUND", "Herramienta no encontrada.");
      emitToolsChanged();
      return toolState();
    },
    "tools.remove": async ({ toolId, deleteData }) => {
      if (!toolInstaller) throw new LensError("E_INTERNAL", "El instalador no está disponible.");
      try {
        await toolInstaller.remove(toolId, deleteData);
      } finally {
        emitToolsChanged();
      }
      return toolState();
    },
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
  const userData = app.getPath("userData");
  const keysDirectory = app.isPackaged
    ? resolve(process.resourcesPath, "keys")
    : resolve(import.meta.dirname, "../../resources/keys");
  toolInstaller = createToolInstaller({
    database,
    userData,
    onToolRemoved: () =>
      publishTabsChanged(tabsStore().list, (tabs) => shellContents?.send("tabs.changed", { tabs })),
    trustedKeys: () =>
      loadTrustedKeys({
        directory: keysDirectory,
        developerMode: getSetting(readyDatabase, "developerMode"),
      }),
    developerMode: () => getSetting(readyDatabase, "developerMode"),
    hostVersion: packageJson.version,
  });
  await scanDevTools({
    directory: process.env.LENSDESK_DEV_TOOLS_DIR,
    isPackaged: app.isPackaged,
    registry: toolInstaller.registry,
  });
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

  shellContents = window.webContents;
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
        tools: () => toolInstaller !== undefined && Array.isArray(toolInstaller.registry.list()),
      },
    );
  }
});

app.on("window-all-closed", () => app.quit());
