import type { MessagePort } from "node:worker_threads";
import type { BackendContext } from "@lensdesk/sdk/backend";
import { createMethods } from "./worker-methods.ts";
import { type FromWorker, safeError, toWorkerSchema, transportError } from "./worker-protocol.ts";

// This process alone owns SQLite, TEMP tables and the prepared restore cache.
export function runDatabaseWorker(port: MessagePort, dataDir: string) {
  const backend = createMethods();
  let active: { id: number; controller: AbortController } | undefined;
  let callId = 0;
  const calls = new Map<
    number,
    {
      resolve: (bytes: Uint8Array) => void;
      reject: (error: Error) => void;
    }
  >();
  const post = (message: FromWorker) => port.postMessage(message);
  port.on("message", (raw: unknown) => {
    const parsed = toWorkerSchema.safeParse(raw);
    if (!parsed.success) {
      port.close();
      return;
    }
    const message = parsed.data;
    if (message.type === "close") {
      if (active) {
        port.close();
        return;
      }
      backend.close();
      port.close();
      return;
    }
    if (message.type === "cancel") {
      if (active?.id === message.id) active.controller.abort();
      return;
    }
    if (message.type === "file-result") {
      if (active?.id !== message.id) return;
      const call = calls.get(message.callId);
      if (!call) return;
      calls.delete(message.callId);
      if (message.result.ok) call.resolve(message.result.bytes ?? new Uint8Array());
      else call.reject(transportError(message.result.error.code));
      return;
    }
    if (active) {
      port.close();
      return;
    }
    const controller = new AbortController();
    active = { id: message.id, controller };
    const file = (
      token: string,
      operation: Extract<FromWorker, { type: "file-call" }>["operation"],
    ) =>
      new Promise<Uint8Array>((resolve, reject) => {
        if (controller.signal.aborted) {
          reject(transportError("E_CANCELLED"));
          return;
        }
        const current = ++callId;
        const abort = () => {
          calls.delete(current);
          reject(transportError("E_CANCELLED"));
        };
        controller.signal.addEventListener("abort", abort, { once: true });
        const finish = () => controller.signal.removeEventListener("abort", abort);
        calls.set(current, {
          resolve: (bytes) => {
            finish();
            resolve(bytes);
          },
          reject: (error) => {
            finish();
            reject(error);
          },
        });
        post({ type: "file-call", id: message.id, callId: current, token, operation });
      });
    const context: BackendContext = {
      dataDir,
      signal: controller.signal,
      files: {
        readBytes: (token) => file(token, { op: "readBytes" }),
        writeBytes: async (token, bytes) => {
          await file(token, { op: "writeBytes", bytes });
        },
      },
      progress: (fraction, phase) => {
        const progress = { type: "progress", id: message.id, fraction, phase };
        // Only the fixed business phase vocabulary crosses the bridge.
        if (!controller.signal.aborted) port.postMessage(progress);
      },
      log: { info: () => {}, warn: () => {}, error: () => {} },
    };
    void (async () => {
      try {
        const result = await backend.methods[message.method](message.params, context);
        post({ type: "result", id: message.id, result });
      } catch (error) {
        post({ type: "error", id: message.id, error: safeError(error) });
      } finally {
        for (const call of calls.values()) call.reject(transportError("E_CANCELLED"));
        calls.clear();
        active = undefined;
      }
    })();
  });
}
