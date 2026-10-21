import { LensError } from "@lensdesk/sdk/errors";
import type { HostSettingKey } from "../shared/host-channels.ts";
import type { createSettingsHandlers } from "./context.ts";
import type { createLoginItem } from "./login-item.ts";
import type { UpdateCheckResult } from "./updates/check.ts";

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function defaultLogsFileName(now: Date): string {
  return `lensdesk-logs-${now.toISOString().slice(0, 10)}.zip`;
}

// Acciones del shell sobre registros, carpeta de datos, enlaces y actualizaciones. Las piezas de
// Electron (diálogo, `shell`) llegan por parámetro.
export function createAppActions(options: {
  userData: string;
  logsDir: string;
  now: () => Date;
  pickSavePath(defaultName: string): Promise<string | undefined>;
  exportLogs(options: { logsDir: string; outFile: string }): Promise<void>;
  openPath(path: string): Promise<string>;
  openExternal(url: string): Promise<void>;
  checkNow(): Promise<UpdateCheckResult>;
  log(event: string, message: string): void;
}) {
  return {
    "logs.export": async () => {
      const outFile = await options.pickSavePath(defaultLogsFileName(options.now()));
      if (!outFile) return { saved: false };
      try {
        await options.exportLogs({ logsDir: options.logsDir, outFile });
      } catch (error) {
        options.log("logs.export", error instanceof Error ? error.message : String(error));
        throw new LensError("E_INTERNAL", "No se pudieron exportar los registros.");
      }
      return { saved: true };
    },
    "app.openDataFolder": async () => {
      const failure = await options.openPath(options.userData);
      if (failure) {
        options.log("app.openDataFolder", failure);
        throw new LensError("E_INTERNAL", "No se pudo abrir la carpeta de datos.");
      }
      return {};
    },
    "app.openExternal": async ({ url }: { url: string }) => {
      if (!isHttpsUrl(url)) throw new LensError("E_INVALID_PARAMS", "Solo se abren enlaces https.");
      await options.openExternal(url);
      return {};
    },
    "updates.checkNow": () => options.checkNow(),
  };
}

export function createLoginSettingsActions(
  settings: Pick<ReturnType<typeof createSettingsHandlers>, "settings.get" | "settings.set">,
  loginItem: ReturnType<typeof createLoginItem>,
) {
  return {
    "settings.get": ({ key }: { key: HostSettingKey }) =>
      key === "app.openAtLogin"
        ? { key, value: loginItem.read() }
        : settings["settings.get"]({ key }),
    "settings.set": ({ key, value }: { key: HostSettingKey; value: unknown }) => {
      // Se guarda y responde el estado confirmado por el sistema, no el pedido.
      if (key === "app.openAtLogin")
        return settings["settings.set"]({ key, value: loginItem.write(value) });
      return settings["settings.set"]({ key, value });
    },
  };
}
