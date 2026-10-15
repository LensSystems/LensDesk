import { LensError } from "@lensdesk/sdk/errors";

type Message = { type: string; [key: string]: unknown };
export type RpcPort = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (message: Message) => void): void;
};
type Pending = {
  resolve(value: unknown): void;
  reject(error: LensError): void;
  onProgress?: (progress: { fraction: number; message?: string }) => void;
};

export function createRpcSession(options: {
  port: RpcPort;
  resolveFile: (op: string, token: string, bytes?: Uint8Array) => Promise<Uint8Array | undefined>;
  log?: (level: string, message: string) => void;
}) {
  const pending = new Map<number, Pending>();
  let nextId = 0;
  let closed = false;
  options.port.on("message", (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "response") {
      const call = pending.get(Number(message.id));
      if (!call) return;
      pending.delete(Number(message.id));
      if (message.error && typeof message.error === "object") {
        const err = message.error as { code?: string; message?: string };
        call.reject(
          new LensError((err.code ?? "E_INTERNAL") as never, err.message ?? "Backend error"),
        );
      } else call.resolve(message.result);
    } else if (message.type === "progress") {
      pending.get(Number(message.id))?.onProgress?.({
        fraction: Number(message.fraction),
        ...(typeof message.message === "string" ? { message: message.message } : {}),
      });
    } else if (message.type === "file-call") {
      const callId = message.callId as number | string;
      void options
        .resolveFile(
          String(message.op),
          String(message.token),
          message.bytes instanceof Uint8Array ? message.bytes : undefined,
        )
        .then(
          (bytes) =>
            options.port.postMessage({
              type: "file-result",
              callId,
              ok: true,
              ...(bytes ? { data: bytes } : {}),
            }),
          (error: unknown) => {
            const err =
              error instanceof LensError
                ? error
                : new LensError("E_INTERNAL", "File operation failed");
            options.port.postMessage({
              type: "file-result",
              callId,
              ok: false,
              error: { code: err.code, message: err.message },
            });
          },
        );
    } else if (message.type === "log") {
      options.log?.(String(message.level), String(message.message));
    }
  });
  return {
    invoke(
      method: string,
      params: unknown,
      onProgress?: Pending["onProgress"],
    ): { id: number; promise: Promise<unknown> } {
      const id = ++nextId;
      if (closed)
        return {
          id,
          promise: Promise.reject(
            new LensError("E_BACKEND_CRASHED", "El backend terminó inesperadamente."),
          ),
        };
      const promise = new Promise<unknown>((resolve, reject) => {
        pending.set(id, { resolve, reject, onProgress });
        options.port.postMessage({ type: "request", id, method, params });
      });
      return { id, promise };
    },
    cancel(id: number): void {
      if (pending.has(id)) options.port.postMessage({ type: "cancel", id });
    },
    close(): void {
      if (closed) return;
      closed = true;
      for (const call of pending.values())
        call.reject(new LensError("E_BACKEND_CRASHED", "El backend terminó inesperadamente."));
      pending.clear();
    },
  };
}
