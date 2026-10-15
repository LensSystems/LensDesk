import type { LensErrorCode } from "./errors.ts";
import { LensError } from "./errors.ts";

export type BackendContext = {
  dataDir: string;
  files: {
    readBytes: (token: string) => Promise<Uint8Array>;
    writeBytes: (token: string, bytes: Uint8Array) => Promise<void>;
  };
  progress: (fraction: number, message?: string) => void;
  signal: AbortSignal;
  log: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
};

export type BackendMethod = (
  params: unknown,
  context: BackendContext,
) => unknown | Promise<unknown>;
export type BackendDefinition = { methods: Record<string, BackendMethod> };

type RuntimeMessage =
  | { type: "request"; id: number | string; method: string; params: unknown }
  | { type: "cancel"; id: number | string }
  | { type: "init"; dataDir: string; toolId: string; hostVersion: string }
  | {
      type: "file-result";
      callId: number | string;
      ok: boolean;
      data?: Uint8Array;
      error?: { code: LensErrorCode; message: string };
    };

type Port = {
  on: (event: "message", listener: (message: RuntimeMessage) => void) => void;
  postMessage: (message: unknown) => void;
};

export function createBackendRuntime(methods: Record<string, BackendMethod>, port: Port) {
  const pending = new Map<number | string, AbortController>();
  let dataDir = "";
  let fileCallId = 0;
  const fileCalls = new Map<
    number,
    { resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void }
  >();

  port.on("message", (message) => {
    if (message.type === "init") {
      dataDir = message.dataDir;
      return;
    }
    if (message.type === "cancel") {
      pending.get(message.id)?.abort();
      return;
    }
    if (message.type === "file-result") {
      const call = fileCalls.get(Number(message.callId));
      if (!call) return;
      fileCalls.delete(Number(message.callId));
      if (message.ok) call.resolve(message.data ?? new Uint8Array());
      else
        call.reject(
          new LensError(
            message.error?.code ?? "E_INTERNAL",
            message.error?.message ?? "File operation failed",
          ),
        );
      return;
    }
    void (async () => {
      const controller = new AbortController();
      pending.set(message.id, controller);
      const files = {
        readBytes: (token: string) => requestFile("readBytes", token),
        writeBytes: async (token: string, bytes: Uint8Array) => {
          await requestFile("writeBytes", token, bytes);
        },
      };
      function requestFile(
        op: "readBytes" | "writeBytes",
        token: string,
        bytes?: Uint8Array,
      ): Promise<Uint8Array> {
        const callId = ++fileCallId;
        return new Promise((resolve, reject) => {
          fileCalls.set(callId, { resolve, reject });
          port.postMessage({ type: "file-call", callId, op, token, ...(bytes ? { bytes } : {}) });
        });
      }
      const context: BackendContext = {
        dataDir,
        files,
        signal: controller.signal,
        progress: (fraction, text) =>
          port.postMessage({
            type: "progress",
            id: message.id,
            fraction,
            ...(text === undefined ? {} : { message: text }),
          }),
        log: {
          info: (text) => port.postMessage({ type: "log", level: "info", message: text }),
          warn: (text) => port.postMessage({ type: "log", level: "warn", message: text }),
          error: (text) => port.postMessage({ type: "log", level: "error", message: text }),
        },
      };
      try {
        const method = methods[message.method];
        if (!method)
          throw new LensError("E_METHOD_NOT_FOUND", `Unknown backend method: ${message.method}`);
        const result = await Promise.race([
          Promise.resolve(method(message.params, context)),
          new Promise<never>((_resolve, reject) => {
            controller.signal.addEventListener(
              "abort",
              () => reject(new LensError("E_CANCELLED", "Request cancelled")),
              { once: true },
            );
          }),
        ]);
        if (controller.signal.aborted) throw new LensError("E_CANCELLED", "Request cancelled");
        port.postMessage({ type: "response", id: message.id, result });
      } catch (error) {
        const lensError =
          error instanceof LensError
            ? error
            : new LensError("E_INTERNAL", error instanceof Error ? error.message : "Backend error");
        port.postMessage({
          type: "response",
          id: message.id,
          error: { code: lensError.code, message: lensError.message },
        });
      } finally {
        pending.delete(message.id);
      }
    })();
  });
  return { methods };
}

export function defineBackend(definition: BackendDefinition) {
  const parentPort = (globalThis as unknown as { process?: { parentPort?: Port } }).process
    ?.parentPort;
  return parentPort
    ? createBackendRuntime(definition.methods, parentPort)
    : { methods: definition.methods };
}
