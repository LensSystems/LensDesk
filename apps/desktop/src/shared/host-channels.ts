import type { LensErrorCode, Result } from "@lensdesk/sdk/errors";

export const HOST_CHANNELS = ["app.getInfo"] as const;
export const HOST_EVENTS = [] as const;
export const HOST_IPC_CHANNEL = "lensdesk:invoke";

export type HostChannel = (typeof HOST_CHANNELS)[number];
export type HostPayloads = { "app.getInfo": Record<string, never> };
export type HostResponses = {
  "app.getInfo": { version: string; platform: string };
};
export type HostEvent = (typeof HOST_EVENTS)[number];

export type HostBridge = {
  invoke<C extends HostChannel>(
    channel: C,
    payload: HostPayloads[C],
  ): Promise<Result<HostResponses[C]>>;
  on(event: HostEvent, callback: (payload: never) => void): () => void;
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
