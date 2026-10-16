import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { LensError } from "@lensdesk/sdk/errors";
import { utilityProcess } from "electron";
import { createRpcSession } from "./rpc-session.ts";

type BackendPort = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (message: never) => void): void;
};
type Tool = { id: string; installPath: string; version: string };
type Child = {
  postMessage(message: unknown): void;
  on(event: "message" | "exit", listener: (...args: never[]) => void): void;
  kill(): void;
};

export function createBackendHost(options: {
  userData: string;
  hostVersion: string;
  getTool(id: string): Tool | undefined;
  resolveFile(
    toolId: string,
    op: string,
    token: string,
    bytes?: Uint8Array,
  ): Promise<Uint8Array | undefined>;
  fork?: (path: string, options: { serviceName: string; env: Record<string, string> }) => Child;
  log?: (toolId: string, level: string, message: string) => void;
  // `expected` es true cuando el host terminó el proceso (cerrar pestaña, quitar o salir).
  onExit?: (toolId: string, code: number, expected: boolean) => void;
}) {
  const children = new Map<
    string,
    { child: Child; session: ReturnType<typeof createRpcSession> }
  >();
  const requestIds = new Map<string, Map<string, number>>();
  const cancelled = new Map<string, Set<string>>();
  const launch =
    options.fork ??
    ((path, settings) => utilityProcess.fork(path, [], settings) as unknown as Child);
  async function get(id: string) {
    const existing = children.get(id);
    if (existing) return existing;
    const tool = options.getTool(id);
    if (!tool) throw new LensError("E_TOOL_NOT_FOUND", "Herramienta no encontrada.");
    const dataDir = join(options.userData, "tool-data", id);
    await mkdir(dataDir, { recursive: true });
    const child = launch(join(tool.installPath, "backend/index.js"), {
      serviceName: `lensdesk-tool-${id}`,
      env: { LENSDESK_TOOL_ID: id },
    });
    const port: BackendPort = {
      postMessage: (message) => child.postMessage(message),
      on: (_event, listener) =>
        child.on("message", ((...args: unknown[]) =>
          listener((args.length > 1 ? args[1] : args[0]) as never)) as never),
    };
    const session = createRpcSession({
      port,
      resolveFile: (op, token, bytes) => options.resolveFile(id, op, token, bytes),
      log: (level, message) => options.log?.(id, level, message),
    });
    children.set(id, { child, session });
    child.postMessage({ type: "init", dataDir, toolId: id, hostVersion: options.hostVersion });
    child.on("exit", ((code: number) => {
      const current = children.get(id)?.child === child;
      options.onExit?.(id, typeof code === "number" ? code : -1, !current);
      session.close();
      if (current) children.delete(id);
    }) as never);
    return { child, session };
  }
  return {
    async invoke(
      id: string,
      requestId: string,
      method: string,
      params: unknown,
      onProgress: (event: { fraction: number; message?: string }) => void,
    ) {
      const backend = await get(id);
      const call = backend.session.invoke(method, params, onProgress);
      let calls = requestIds.get(id);
      if (!calls) {
        calls = new Map();
        requestIds.set(id, calls);
      }
      calls.set(requestId, call.id);
      if (cancelled.get(id)?.delete(requestId)) backend.session.cancel(call.id);
      try {
        return await call.promise;
      } finally {
        calls.delete(requestId);
      }
    },
    cancel(id: string, requestId: string) {
      const callId = requestIds.get(id)?.get(requestId);
      if (callId !== undefined) children.get(id)?.session.cancel(callId);
      else {
        let calls = cancelled.get(id);
        if (!calls) {
          calls = new Set();
          cancelled.set(id, calls);
        }
        calls.add(requestId);
      }
    },
    terminate(id: string) {
      const backend = children.get(id);
      if (!backend) return;
      children.delete(id);
      requestIds.delete(id);
      cancelled.delete(id);
      backend.session.close();
      backend.child.kill();
    },
    terminateAll() {
      for (const id of [...children.keys()]) this.terminate(id);
    },
  };
}
