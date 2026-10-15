import type { ToolBridge } from "@lensdesk/sdk";
import type { LensErrorCode, Result } from "@lensdesk/sdk/errors";

export const TOOL_CHANNELS = [
  "storage.get",
  "storage.set",
  "storage.delete",
  "storage.keys",
  "files.pickOpen",
  "files.pickSave",
  "files.readText",
  "files.readBytes",
  "files.writeText",
  "backend.invoke",
  "backend.cancel",
  "app.getContext",
  "ui.toast",
  "ui.copyText",
  "ui.openExternal",
] as const;
export const TOOL_EVENTS = ["files.drop", "backend.progress", "app.contextChanged"] as const;
export const TOOL_IPC_CHANNEL = "lensdesk:tool-invoke";
export const TOOL_DROP_REGISTER_CHANNEL = "lensdesk:tool-drop-register-internal";
export type ToolChannel = (typeof TOOL_CHANNELS)[number];
export type ToolEvent = (typeof TOOL_EVENTS)[number];
export type ToolContextPayload = {
  locale: string;
  theme: string;
  hostVersion: string;
  toolVersion: string;
};
export type FileHandle = { token: string; name: string; size: number };
export function registerDroppedFiles(
  files: readonly File[],
  getPath: (file: File) => string,
  register: (paths: string[]) => Promise<FileHandle[]>,
): Promise<FileHandle[]> {
  return register(files.map(getPath));
}
type Invoker = (channel: string, payload: unknown) => Promise<unknown>;
type Subscriber = (event: string, callback: (payload: unknown) => void) => () => void;
function failure(code: LensErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

export function createToolBridge(invoke: Invoker, subscribe: Subscriber) {
  const call = async <T = unknown>(channel: ToolChannel, payload: unknown): Promise<Result<T>> => {
    if (!TOOL_CHANNELS.includes(channel))
      return failure("E_METHOD_NOT_FOUND", `Canal desconocido: ${channel}`);
    try {
      return (await invoke(channel, payload)) as Result<T>;
    } catch {
      return failure("E_INTERNAL", "Error interno");
    }
  };
  const listen = (event: ToolEvent, callback: (payload: unknown) => void) =>
    TOOL_EVENTS.includes(event) ? subscribe(event, callback) : () => undefined;
  const bridge = {
    storage: {
      get: (key: string) => call("storage.get", { key }),
      set: (key: string, value: unknown) => call<void>("storage.set", { key, value }),
      delete: (key: string) => call<void>("storage.delete", { key }),
      keys: () => call<string[]>("storage.keys", {}),
    },
    files: {
      pickOpen: (options: {
        filters?: { name: string; extensions: string[] }[];
        multiple?: boolean;
      }) => call<{ token: string; name: string; size: number }[]>("files.pickOpen", options),
      pickSave: (options: {
        defaultName?: string;
        filters?: { name: string; extensions: string[] }[];
      }) => call<{ token: string; name: string; size: number } | null>("files.pickSave", options),
      readText: (token: string) => call<string>("files.readText", { token }),
      readBytes: (token: string) => call<Uint8Array>("files.readBytes", { token }),
      writeText: (token: string, text: string) => call<void>("files.writeText", { token, text }),
      onDrop: (callback: (files: { token: string; name: string; size: number }[]) => void) =>
        listen("files.drop", (payload) =>
          callback(payload as { token: string; name: string; size: number }[]),
        ),
    },
    backend: {
      invoke: (requestId: string, method: string, params: unknown) =>
        call("backend.invoke", { requestId, method, params }),
      cancel: (requestId: string) => call<void>("backend.cancel", { requestId }),
      onProgress: (
        callback: (event: { fraction: number; message?: string; requestId: string }) => void,
      ) =>
        listen("backend.progress", (payload) =>
          callback(payload as { fraction: number; message?: string; requestId: string }),
        ),
    },
    app: {
      getContext: () => call<ToolContextPayload>("app.getContext", {}),
      onContextChange: (callback: (context: ToolContextPayload) => void) =>
        listen("app.contextChanged", (payload) => callback(payload as ToolContextPayload)),
    },
    ui: {
      toast: (toast: { kind: string; message: string }) => call<void>("ui.toast", toast),
      copyText: (text: string) => call<void>("ui.copyText", { text }),
      openExternal: (httpsUrl: string) => call<void>("ui.openExternal", { url: httpsUrl }),
    },
  };
  return Object.freeze(bridge) satisfies ToolBridge;
}

declare global {
  interface Window {
    lensdesk: ToolBridge;
  }
}
