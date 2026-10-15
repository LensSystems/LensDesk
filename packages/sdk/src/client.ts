import type { FileHandle, InvokeOptions, ToolBridge, ToolContext } from "./api.ts";
import { LensError } from "./errors.ts";

export function createToolClient(bridge: ToolBridge = window.lensdesk) {
  async function unwrap<T>(result: Awaited<ReturnType<ToolBridge["storage"]["get"]>>): Promise<T> {
    if (!result.ok) throw new LensError(result.error.code, result.error.message);
    return result.data as T;
  }

  return {
    storage: {
      get: async (key: string) => unwrap<unknown>(await bridge.storage.get(key)),
      set: async (key: string, value: unknown) =>
        unwrap<void>(await bridge.storage.set(key, value)),
      delete: async (key: string) => unwrap<void>(await bridge.storage.delete(key)),
      keys: async () => unwrap<string[]>(await bridge.storage.keys()),
    },
    files: {
      pickOpen: async (options: {
        filters?: { name: string; extensions: string[] }[];
        multiple?: boolean;
      }) => unwrap<FileHandle[]>(await bridge.files.pickOpen(options)),
      pickSave: async (options: {
        defaultName?: string;
        filters?: { name: string; extensions: string[] }[];
      }) => unwrap<FileHandle | null>(await bridge.files.pickSave(options)),
      readText: async (token: string) => unwrap<string>(await bridge.files.readText(token)),
      readBytes: async (token: string) => unwrap<Uint8Array>(await bridge.files.readBytes(token)),
      writeText: async (token: string, text: string) =>
        unwrap<void>(await bridge.files.writeText(token, text)),
      onDrop: (callback: (files: FileHandle[]) => void) => bridge.files.onDrop(callback),
    },
    backend: {
      invoke: <T = unknown>(
        method: string,
        params?: unknown,
        options: InvokeOptions = {},
      ): Promise<T> => {
        const { signal, onProgress } = options;
        if (signal?.aborted)
          return Promise.reject(new LensError("E_CANCELLED", "Request cancelled"));
        const requestId = crypto.randomUUID();
        const unsubscribe = onProgress
          ? bridge.backend.onProgress((event) => {
              if (event.requestId === requestId)
                onProgress({
                  fraction: event.fraction,
                  ...(event.message === undefined ? {} : { message: event.message }),
                });
            })
          : () => {};
        return new Promise<T>((resolve, reject) => {
          let settled = false;
          const cleanup = () => {
            signal?.removeEventListener("abort", abort);
            unsubscribe();
          };
          const finish = (callback: () => void) => {
            if (settled) return;
            settled = true;
            cleanup();
            callback();
          };
          const abort = () => {
            void bridge.backend.cancel(requestId);
            finish(() => reject(new LensError("E_CANCELLED", "Request cancelled")));
          };
          signal?.addEventListener("abort", abort, { once: true });
          void bridge.backend.invoke(requestId, method, params).then(
            (result) => {
              if (result.ok) finish(() => resolve(result.data as T));
              else finish(() => reject(new LensError(result.error.code, result.error.message)));
            },
            (error: unknown) => finish(() => reject(error)),
          );
        });
      },
    },
    app: {
      getContext: async () => unwrap<ToolContext>(await bridge.app.getContext()),
      onContextChange: (callback: (context: ToolContext) => void) =>
        bridge.app.onContextChange(callback),
    },
    ui: {
      toast: async (toast: { kind: string; message: string }) =>
        unwrap<void>(await bridge.ui.toast(toast)),
      copyText: async (text: string) => unwrap<void>(await bridge.ui.copyText(text)),
      openExternal: async (httpsUrl: string) =>
        unwrap<void>(await bridge.ui.openExternal(httpsUrl)),
    },
  };
}

declare global {
  interface Window {
    lensdesk: ToolBridge;
  }
}
