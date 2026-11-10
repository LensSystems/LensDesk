import { Worker } from "node:worker_threads";
import type { BackendContext, BackendMethod } from "@lensdesk/sdk/backend";
import {
  fromWorkerSchema,
  type MethodName,
  methodNames,
  safeError,
  type ToWorker,
  transportError,
  workerMarker,
} from "./worker-protocol.ts";

type WorkerFactory = (dataDir: string) => Worker;
type Job = {
  id: number;
  method: MethodName;
  params: unknown;
  ctx: BackendContext;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  cancelled: boolean;
  detach: () => void;
  calls: Set<number>;
};
type Owner = {
  worker?: Worker;
  active?: Job;
  queue: Job[];
  closing?: boolean;
  stopping?: boolean;
  stopped?: Promise<void>;
  confirmStop?: () => void;
};
const queueLimit = 32;

export function createWorkerClient(factory: WorkerFactory) {
  const owners = new Map<string, Owner>();
  let nextId = 0;
  let pendingFiles = 0;
  let disposed = false;
  const idleWaiters = new Set<() => void>();
  function idle() {
    if ([...owners.values()].every((owner) => !owner.active)) {
      for (const resolve of idleWaiters) resolve();
      idleWaiters.clear();
    }
  }
  function rejectJobs(owner: Owner) {
    const jobs = [...(owner.active ? [owner.active] : []), ...owner.queue];
    owner.active = undefined;
    owner.queue = [];
    for (const job of jobs) {
      job.detach();
      job.reject(transportError("E_BACKEND_CRASHED"));
    }
  }
  function stopped(owner: Owner, worker: Worker) {
    if (owner.worker !== worker) return;
    if (!owner.stopping && !owner.closing) rejectJobs(owner);
    owner.worker = undefined;
    owner.stopping = false;
    owner.confirmStop?.();
    idle();
  }
  function fail(owner: Owner, worker: Worker) {
    if (owner.worker !== worker || owner.stopping) return;
    owner.stopping = true;
    rejectJobs(owner);
    // A termination request is not proof that native SQLite has released the database.
    worker.ref();
    try {
      void worker.terminate().then(
        () => stopped(owner, worker),
        () => {},
      );
    } catch {
      /* Retain ownership until the actual exit event. */
    }
    idle();
  }
  function post(owner: Owner, message: ToWorker) {
    const worker = owner.worker;
    if (!worker || owner.stopping) return;
    try {
      worker.postMessage(message);
    } catch {
      fail(owner, worker);
    }
  }
  function start(owner: Owner, dataDir: string) {
    if (owner.stopping || owner.active || !owner.queue.length || disposed) {
      idle();
      return;
    }
    if (!owner.worker) {
      let worker: Worker;
      try {
        worker = factory(dataDir);
      } catch {
        for (const job of owner.queue) {
          job.detach();
          job.reject(transportError("E_BACKEND_UNAVAILABLE"));
        }
        owner.queue = [];
        idle();
        return;
      }
      owner.worker = worker;
      owner.stopped = new Promise<void>((resolve) => {
        owner.confirmStop = resolve;
      });
      worker.on("error", () => fail(owner, worker));
      worker.on("exit", () => stopped(owner, worker));
      worker.on("message", (raw: unknown) => {
        if (owner.worker !== worker || owner.stopping || owner.closing) return;
        const parsed = fromWorkerSchema.safeParse(raw);
        const job = owner.active;
        if (!parsed.success || !job || parsed.data.id !== job.id) {
          fail(owner, worker);
          return;
        }
        const message = parsed.data;
        if (message.type === "progress") {
          if (!job.cancelled) job.ctx.progress(message.fraction, message.phase);
          return;
        }
        if (message.type === "file-call") {
          if (job.calls.has(message.callId) || job.calls.size >= 128) {
            fail(owner, worker);
            return;
          }
          job.calls.add(message.callId);
          if (job.cancelled) {
            post(owner, {
              type: "file-result",
              id: job.id,
              callId: message.callId,
              result: { ok: false, error: { code: "E_CANCELLED" } },
            });
            return;
          }
          if (pendingFiles >= 32) {
            post(owner, {
              type: "file-result",
              id: job.id,
              callId: message.callId,
              result: { ok: false, error: { code: "E_BACKEND_UNAVAILABLE" } },
            });
            return;
          }
          pendingFiles++;
          void (async () => {
            let result: Extract<ToWorker, { type: "file-result" }>["result"];
            try {
              if (message.operation.op === "readBytes") {
                const bytes = await job.ctx.files.readBytes(message.token);
                result = { ok: true, bytes };
              } else {
                await job.ctx.files.writeBytes(message.token, message.operation.bytes);
                result = { ok: true };
              }
            } catch (error) {
              result = { ok: false, error: safeError(error) };
            } finally {
              // Native capabilities retain their budget across cancellation and worker death.
              pendingFiles--;
            }
            // A late capability response cannot be routed into a successor job or worker.
            if (owner.worker === worker && owner.active === job && !job.cancelled)
              post(owner, { type: "file-result", id: job.id, callId: message.callId, result });
          })();
          return;
        }
        job.detach();
        owner.active = undefined;
        if (!job.cancelled) {
          if (message.type === "error") job.reject(transportError(message.error.code));
          else job.resolve(message.result);
        }
        worker.unref();
        start(owner, dataDir);
      });
    }
    const job = owner.queue.shift();
    if (!job) return;
    owner.active = job;
    owner.worker.ref();
    post(owner, { type: "run", id: job.id, method: job.method, params: job.params });
  }
  function request(method: MethodName, params: unknown, ctx: BackendContext): Promise<unknown> {
    if (disposed) return Promise.reject(transportError("E_BACKEND_UNAVAILABLE"));
    if (ctx.signal.aborted) return Promise.reject(transportError("E_CANCELLED"));
    for (const [dir, owner] of owners)
      if (!owner.worker && !owner.active && !owner.queue.length) owners.delete(dir);
    let owner = owners.get(ctx.dataDir);
    if (!owner) {
      if (owners.size >= 2) return Promise.reject(transportError("E_BACKEND_UNAVAILABLE"));
      owner = { queue: [] };
      owners.set(ctx.dataDir, owner);
    }
    const current = owner;
    if (current.stopping) return Promise.reject(transportError("E_BACKEND_UNAVAILABLE"));
    if (current.queue.length + Number(Boolean(current.active)) >= queueLimit)
      return Promise.reject(transportError("E_BACKEND_UNAVAILABLE"));
    return new Promise((resolve, reject) => {
      const job: Job = {
        id: ++nextId,
        method,
        params,
        ctx,
        resolve,
        reject,
        cancelled: false,
        detach: () => ctx.signal.removeEventListener("abort", abort),
        calls: new Set(),
      };
      function abort() {
        job.cancelled = true;
        job.detach();
        reject(transportError("E_CANCELLED"));
        if (current.active === job) post(current, { type: "cancel", id: job.id });
        else current.queue = current.queue.filter((item) => item !== job);
        // Cancellation settles the caller, never the database ownership gate.
      }
      ctx.signal.addEventListener("abort", abort, { once: true });
      current.queue.push(job);
      start(current, ctx.dataDir);
    });
  }
  const methods = Object.create(null) as Record<MethodName, BackendMethod>;
  for (const name of methodNames) methods[name] = (params, ctx) => request(name, params, ctx);
  async function dispose() {
    disposed = true;
    for (const owner of owners.values()) {
      for (const job of owner.queue) {
        job.detach();
        job.reject(transportError("E_CANCELLED"));
      }
      owner.queue = [];
      if (owner.active) {
        const job = owner.active;
        job.cancelled = true;
        job.detach();
        job.reject(transportError("E_CANCELLED"));
        post(owner, { type: "cancel", id: job.id });
      }
    }
    if ([...owners.values()].some((owner) => owner.active))
      await new Promise<void>((resolve) => idleWaiters.add(resolve));
    await Promise.all(
      [...owners.values()].map(async (owner) => {
        const worker = owner.worker;
        if (!worker) return;
        if (!owner.stopping) {
          owner.closing = true;
          worker.ref();
          post(owner, { type: "close" });
        }
        await owner.stopped;
      }),
    );
    owners.clear();
  }
  return { methods, dispose };
}
export function databaseWorkerFactory(url: URL): WorkerFactory {
  return (dataDir) =>
    new Worker(url, { execArgv: [], workerData: { marker: workerMarker, dataDir } });
}
