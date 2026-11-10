import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MessageChannel, Worker } from "node:worker_threads";
import { createBackendRuntime } from "@lensdesk/sdk/backend";
import { build } from "vite";
import { fileContext } from "./backup-test-context.ts";
import { createWorkerClient, databaseWorkerFactory } from "./worker-client.ts";
import { workerMarker } from "./worker-protocol.ts";

type Port = Parameters<typeof createBackendRuntime>[1];
type Incoming = Parameters<Parameters<Port["on"]>[1]>[0];
export type Response = {
  type: "response";
  id: number;
  result?: unknown;
  error?: { code: string; message: string };
};
export async function workerBundles() {
  const dir = mkdtempSync(join(tmpdir(), "ventas-worker-bundle-"));
  const entry = resolve("tools/ventas/src/backend/index.ts");
  const fixture = join(dir, "fixture.ts");
  // Instrument only this temporary bundle: signal and stall the real SQLite COMMIT,
  // after replacement and receipt insertion, without delaying the receiving thread.
  writeFileSync(
    fixture,
    `
import { DatabaseSync } from "node:sqlite";
import { workerData } from "node:worker_threads";
import ${JSON.stringify(entry)};
const trace = workerData?.commitTrace ? new Int32Array(workerData.commitTrace) : null;
const exec = DatabaseSync.prototype.exec;
let delayed = false;
DatabaseSync.prototype.exec = function(sql) {
  if (trace && !delayed && sql === "COMMIT" &&
      this.prepare("SELECT 1 FROM sqlite_schema WHERE name='restore_receipts'").get() &&
      (this.prepare("SELECT COUNT(*) n FROM restore_receipts").get().n > 0 ||
       this.prepare("SELECT COUNT(*) n FROM operations").get().n > 0)) {
    delayed = true;
    const start = performance.now();
    Atomics.store(trace, 0, 1);
    Atomics.wait(trace, 3, 0, 1500);
    const result = exec.call(this, sql);
    Atomics.store(trace, 2, Math.ceil(performance.now() - start));
    Atomics.store(trace, 1, 1);
    return result;
  }
  return exec.call(this, sql);
};
`,
  );
  for (const [name, input] of [
    ["real", entry],
    ["slow", fixture],
  ] as const) {
    await build({
      configFile: false,
      root: process.cwd(),
      logLevel: "silent",
      ssr: { noExternal: true },
      build: {
        ssr: input,
        outDir: join(dir, name),
        target: "node24",
        emptyOutDir: true,
        rollupOptions: {
          output: { format: "es", entryFileNames: "index.js", inlineDynamicImports: true },
        },
      },
    });
    writeFileSync(join(dir, name, "package.json"), '{"type":"module"}');
  }
  return {
    dir,
    real: pathToFileURL(join(dir, "real/index.js")),
    slow: pathToFileURL(join(dir, "slow/index.js")),
  };
}
export function rpc(dataDir: string, url: URL, commitTrace?: SharedArrayBuffer) {
  const workers: Worker[] = [];
  const factory = databaseWorkerFactory(url);
  const client = createWorkerClient((dir) => {
    const worker = commitTrace
      ? new Worker(url, {
          execArgv: [],
          workerData: { marker: workerMarker, dataDir: dir, commitTrace },
        })
      : factory(dir);
    workers.push(worker);
    return worker;
  });
  const files = fileContext(dataDir);
  const { port1, port2 } = new MessageChannel();
  const listener = (message: Incoming) => port2.postMessage(message);
  let id = 0;
  const pending = new Map<number, (response: Response) => void>();
  const messages: unknown[] = [];
  createBackendRuntime(client.methods, {
    on: (event, callback) => port1.on(event, callback),
    postMessage: (message) => port1.postMessage(message),
  });
  port2.on("message", (raw: unknown) => {
    const message = raw as {
      type: string;
      id: number;
      callId: number;
      op: string;
      token: string;
      bytes: Uint8Array;
    };
    messages.push(raw);
    if (message.type === "response") {
      pending.get(message.id)?.(raw as Response);
      pending.delete(message.id);
    }
    if (message.type === "file-call")
      void (async () => {
        try {
          const data =
            message.op === "readBytes"
              ? await files.ctx.files.readBytes(message.token)
              : await files.ctx.files.writeBytes(message.token, message.bytes);
          listener({
            type: "file-result",
            callId: message.callId,
            ok: true,
            ...(data ? { data } : {}),
          });
        } catch {
          listener({
            type: "file-result",
            callId: message.callId,
            ok: false,
            error: { code: "E_PATH_NOT_GRANTED", message: "Token denied" },
          });
        }
      })();
  });
  listener({ type: "init", dataDir, toolId: "ventas", hostVersion: "0.5.0" });
  return {
    ...files,
    client: {
      methods: client.methods,
      async dispose() {
        try {
          await client.dispose();
        } finally {
          port1.close();
          port2.close();
        }
      },
    },
    workers,
    messages,
    request(method: string, params: unknown = {}) {
      const current = ++id;
      const response = new Promise<Response>((resolve) => pending.set(current, resolve));
      listener({ type: "request", id: current, method, params });
      return { id: current, response };
    },
    cancel(current: number) {
      listener({ type: "cancel", id: current });
    },
  };
}
export async function until(predicate: () => boolean, timeout = 10000) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > timeout) throw new Error("Worker condition timed out");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
