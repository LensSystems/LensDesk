import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { HOST_IPC_CHANNEL } from "../shared/host-channels.ts";
import { createRouter } from "./ipc/router.ts";
import { ipcSchemas } from "./ipc/schemas.ts";
import { configureRuntime, runSmoke } from "./runtime.ts";

const packageJson = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8"),
) as { version: string };
const smoke = configureRuntime(process.argv, process.env.LENSDESK_USER_DATA, (path) =>
  app.setPath("userData", path),
);
let shellContents: Electron.WebContents | undefined;
const router = createRouter({
  schemas: ipcSchemas,
  handlers: {
    "app.getInfo": () => ({ version: packageJson.version, platform: process.platform }),
  },
  isShellSender: (sender) => shellContents !== undefined && sender === shellContents,
});

ipcMain.handle(HOST_IPC_CHANNEL, (event, channel: string, payload: unknown) =>
  router(event.sender, channel, payload),
);

void app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: !smoke,
    webPreferences: {
      preload: resolve(import.meta.dirname, "../preload/host.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  shellContents = window.webContents;
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
    );
  }
});

app.on("window-all-closed", () => app.quit());
