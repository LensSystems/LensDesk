import type { LensErrorCode, Result } from "@lensdesk/sdk/errors";

export const HOST_CHANNELS = [
  "app.getInfo",
  "settings.get",
  "settings.set",
  "app.getContext",
  "tabs.list",
  "tabs.open",
  "tabs.close",
  "tabs.activate",
  "shell.showPage",
  "tools.list",
  "tools.pickAndInstall",
  "tools.installFromPath",
  "tools.confirmDowngrade",
  "tools.setEnabled",
  "tools.remove",
  "logs.export",
  "app.openDataFolder",
  "app.openExternal",
  "updates.checkNow",
] as const;
export const HOST_EVENTS = [
  "settings.changed",
  "context.changed",
  "tabs.changed",
  "tools.changed",
  "tools.toast",
  "update.available",
  "tool.crashed",
  "app.error",
] as const;
export const HOST_IPC_CHANNEL = "lensdesk:invoke";

export type HostChannel = (typeof HOST_CHANNELS)[number];
export type HostPayloads = {
  "app.getInfo": Record<string, never>;
  "settings.get": { key: HostSettingKey };
  "settings.set": { key: HostSettingKey; value: unknown };
  "app.getContext": Record<string, never>;
  "tabs.list": Record<string, never>;
  "tabs.open": { toolId: string };
  "tabs.close": { toolId: string };
  "tabs.activate": { toolId: string };
  "shell.showPage": { page: "tools" | "settings" };
  "tools.list": Record<string, never>;
  "tools.pickAndInstall": Record<string, never>;
  "tools.installFromPath": { path: string };
  "tools.confirmDowngrade": { toolId: string; version: string };
  "tools.setEnabled": { toolId: string; enabled: boolean };
  "tools.remove": { toolId: string; deleteData: boolean };
  "logs.export": Record<string, never>;
  "app.openDataFolder": Record<string, never>;
  "app.openExternal": { url: string };
  "updates.checkNow": Record<string, never>;
};
export type HostSettingKey =
  | "locale"
  | "theme"
  | "developerMode"
  | "updates.check"
  | "updates.lastCheckedAt"
  | "updates.dismissedVersion"
  | "window.bounds";
export type HostSettingValue = unknown;
export type HostResponses = {
  "app.getInfo": { version: string; platform: string };
  "settings.get": { key: HostSettingKey; value: HostSettingValue };
  "settings.set": { key: HostSettingKey; value: HostSettingValue };
  "app.getContext": { locale: "es" | "en"; theme: "dark" | "light" };
  "tabs.list": { tabs: ShellTab[] };
  "tabs.open": { tabs: ShellTab[] };
  "tabs.close": { tabs: ShellTab[] };
  "tabs.activate": { tabs: ShellTab[] };
  "shell.showPage": { page: "tools" | "settings" };
  "tools.list": ToolState;
  "tools.pickAndInstall": ToolState;
  "tools.installFromPath": ToolState;
  "tools.confirmDowngrade": ToolState;
  "tools.setEnabled": ToolState;
  "tools.remove": ToolState;
  "logs.export": { saved: boolean };
  "app.openDataFolder": Record<string, never>;
  "app.openExternal": Record<string, never>;
  "updates.checkNow": UpdateCheckResult;
};
export type UpdateCheckResult =
  | { kind: "skipped" }
  | { kind: "none" }
  | { kind: "available"; version: string; url: string };
export type PendingDowngrade = {
  toolId: string;
  installedVersion: string;
  version: string;
};
export type ToolState = {
  tools: ToolSummary[];
  pendingDowngrade: PendingDowngrade | null;
};
export type ToolSummary = {
  id: string;
  version: string;
  manifest: Record<string, unknown>;
  enabled: boolean;
  signed: boolean;
  keyId: string | null;
  installedAt: string;
  updatedAt: string;
};
export type ShellTab = { toolId: string; position: number; active: boolean };
export type HostEvent = (typeof HOST_EVENTS)[number];
export type HostEventPayloads = {
  "settings.changed": { key: HostSettingKey; value: HostSettingValue };
  "context.changed": { locale: "es" | "en"; theme: "dark" | "light" };
  "tabs.changed": { tabs: ShellTab[] };
  "tools.changed": ToolState;
  "tools.toast": { toolId: string; kind: string; message: string };
  "update.available": { version: string; html_url: string };
  "tool.crashed": { toolId: string };
  "app.error": { kind: "uncaught" | "rejection" };
};

export type HostBridge = {
  readonly platform: string;
  invoke<C extends HostChannel>(
    channel: C,
    payload: HostPayloads[C],
  ): Promise<Result<HostResponses[C]>>;
  on<E extends HostEvent>(event: E, callback: (payload: HostEventPayloads[E]) => void): () => void;
  pathForFile(file: File): string;
};

export function createHostBridge(
  invoke: (channel: string, payload: unknown) => Promise<unknown>,
  subscribe: (event: string, callback: (payload: unknown) => void) => () => void,
): HostBridge {
  return Object.freeze({
    async invoke(channel: string, payload: unknown) {
      if (!HOST_CHANNELS.some((allowed) => allowed === channel)) {
        return {
          ok: false,
          error: {
            code: "E_METHOD_NOT_FOUND" as LensErrorCode,
            message: `Canal desconocido: ${channel}`,
          },
        };
      }
      try {
        return (await invoke(channel, payload)) as Result<HostResponses[HostChannel]>;
      } catch {
        return { ok: false, error: { code: "E_INTERNAL", message: "Error interno" } };
      }
    },
    on(event: string, callback: (payload: unknown) => void) {
      if (!HOST_EVENTS.some((allowed) => allowed === event)) return () => undefined;
      return subscribe(event, callback);
    },
  }) as HostBridge;
}

declare global {
  interface Window {
    lensdeskHost: HostBridge;
  }
}
