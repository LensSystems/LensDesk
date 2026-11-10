import { EventEmitter } from "node:events";
import type { Worker } from "node:worker_threads";
import { expect, it } from "vitest";
import { fileContext } from "./backup-test-context.ts";
import { createWorkerClient } from "./worker-client.ts";
import { fromWorkerSchema, toWorkerSchema } from "./worker-protocol.ts";

class TestWorker extends EventEmitter {
  sent: unknown[] = [];
  terminated = false;
  postMessage(message: { type: string }) {
    this.sent.push(message);
    if (message.type === "close") queueMicrotask(() => this.emit("exit", 0));
  }
  ref() {
    return this;
  }
  unref() {
    return this;
  }
  async terminate() {
    this.terminated = true;
    queueMicrotask(() => this.emit("exit", 1));
    return 1;
  }
}
function setup(makeWorker: () => TestWorker = () => new TestWorker()) {
  const workers: TestWorker[] = [];
  const client = createWorkerClient(() => {
    const worker = makeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  });
  return { client, workers, context: fileContext("/trusted").ctx };
}
it("validates both directions, fixed methods, errors and capability envelopes", () => {
  for (const raw of [
    { type: "run", id: 1, method: "eval", params: "anything" },
    { type: "run", id: 1, method: "snapshot", params: {}, dataDir: "/foreign" },
    { type: "cancel", id: -1 },
    { type: "file-result", id: 1, callId: 1, result: { ok: false, error: { code: "E_UNKNOWN" } } },
    { type: "file-result", id: 1, callId: 1, result: { ok: true, bytes: "/real/path" } },
  ])
    expect(toWorkerSchema.safeParse(raw).success).toBe(false);
  for (const raw of [
    { type: "file-call", id: 1, callId: 1, token: "x", operation: { op: "unlink" } },
    {
      type: "file-call",
      id: 1,
      callId: 1,
      token: "x",
      operation: { op: "readBytes", path: "/foreign" },
    },
    { type: "progress", id: 1, fraction: 0.5, phase: "/private/path" },
    { type: "error", id: 1, error: { code: "E_INTERNAL", message: "/private/path" } },
  ])
    expect(fromWorkerSchema.safeParse(raw).success).toBe(false);
});
it("retains ownership after cancellation, never sends a queued cancelled mutation, and bounds the queue", async () => {
  const { client, workers, context } = setup();
  const controller = new AbortController();
  const first = client.methods.snapshot({}, { ...context, signal: controller.signal });
  const rejected = expect(first).rejects.toMatchObject({ code: "E_CANCELLED" });
  controller.abort();
  await rejected;
  const queuedController = new AbortController();
  const skipped = client.methods.execute({}, { ...context, signal: queuedController.signal });
  const skippedError = expect(skipped).rejects.toMatchObject({ code: "E_CANCELLED" });
  queuedController.abort();
  await skippedError;
  const queue = Array.from({ length: 31 }, () => client.methods.snapshot({}, context));
  await expect(client.methods.snapshot({}, context)).rejects.toMatchObject({
    code: "E_BACKEND_UNAVAILABLE",
  });
  const worker = workers[0];
  expect(worker?.sent).toEqual([
    { type: "run", id: 1, method: "snapshot", params: {} },
    { type: "cancel", id: 1 },
  ]);
  worker?.emit("message", { type: "result", id: 1, result: "committed" });
  for (let n = 0; n < queue.length; n++) {
    worker?.emit("message", { type: "result", id: n + 3, result: n });
    expect(await queue[n]).toBe(n);
  }
  expect(worker?.terminated).toBe(false);
  await client.dispose();
});
it("rejects active and queued jobs after crash without retry; a later explicit call creates a new owner", async () => {
  const { client, workers, context } = setup();
  const active = client.methods.execute({}, context);
  const queued = client.methods.snapshot({}, context);
  const results = Promise.all([
    expect(active).rejects.toMatchObject({ code: "E_BACKEND_CRASHED" }),
    expect(queued).rejects.toMatchObject({ code: "E_BACKEND_CRASHED" }),
  ]);
  workers[0]?.emit("error", new Error("/private/path"));
  await results;
  expect(workers).toHaveLength(1);
  const next = client.methods.snapshot({}, context);
  workers[1]?.emit("message", { type: "result", id: 3, result: "new explicit request" });
  expect(await next).toBe("new explicit request");
  await client.dispose();
});
it("binds files to the active context and discards late capability replies after cancellation", async () => {
  const { client, workers, context } = setup();
  let read = 0;
  let complete: (bytes: Uint8Array) => void = () => {};
  const controller = new AbortController();
  const first = client.methods.backupPrepare(
    {},
    {
      ...context,
      signal: controller.signal,
      files: {
        ...context.files,
        readBytes: () => {
          read++;
          return new Promise((resolve) => {
            complete = resolve;
          });
        },
      },
    },
  );
  workers[0]?.emit("message", {
    type: "file-call",
    id: 1,
    callId: 1,
    token: "owned",
    operation: { op: "readBytes" },
  });
  expect(read).toBe(1);
  const cancelled = expect(first).rejects.toMatchObject({ code: "E_CANCELLED" });
  controller.abort();
  await cancelled;
  workers[0]?.emit("message", { type: "error", id: 1, error: { code: "E_CANCELLED" } });
  const next = client.methods.snapshot({}, context);
  complete(new Uint8Array([42]));
  await Promise.resolve();
  expect(
    workers[0]?.sent.filter((message) => (message as { type: string }).type === "file-result"),
  ).toHaveLength(0);
  workers[0]?.emit("message", { type: "result", id: 2, result: "ok" });
  await next;
  await client.dispose();
});
for (const invalid of [
  { type: "file-call", id: 99, callId: 1, token: "foreign", operation: { op: "readBytes" } },
  {
    type: "file-call",
    id: 1,
    callId: 1,
    token: "foreign",
    operation: { op: "readBytes", path: "/foreign" },
  },
])
  it("rejects a foreign or malformed capability call without invoking files", async () => {
    const { client, workers, context } = setup();
    let reads = 0;
    const result = client.methods.snapshot(
      {},
      {
        ...context,
        files: {
          ...context.files,
          readBytes: async () => {
            reads++;
            return new Uint8Array();
          },
        },
      },
    );
    const rejected = expect(result).rejects.toMatchObject({ code: "E_BACKEND_CRASHED" });
    workers[0]?.emit("message", invalid);
    await rejected;
    expect(reads).toBe(0);
    await client.dispose();
  });
it("denies duplicate capability IDs and never passes file paths in errors", async () => {
  const { client, workers, context } = setup();
  const request = client.methods.backupPrepare({}, context);
  const result = expect(request).rejects.toMatchObject({ code: "E_BACKEND_CRASHED" });
  const message = {
    type: "file-call",
    id: 1,
    callId: 1,
    token: "unknown",
    operation: { op: "readBytes" },
  };
  workers[0]?.emit("message", message);
  await Promise.resolve();
  await Promise.resolve();
  expect(workers[0]?.sent).toContainEqual({
    type: "file-result",
    id: 1,
    callId: 1,
    result: { ok: false, error: { code: "E_PATH_NOT_GRANTED" } },
  });
  workers[0]?.emit("message", message);
  await result;
  await client.dispose();
});
it("does not spawn for an already cancelled context", async () => {
  const { client, workers, context } = setup();
  const controller = new AbortController();
  controller.abort();
  await expect(
    client.methods.snapshot({}, { ...context, signal: controller.signal }),
  ).rejects.toMatchObject({ code: "E_CANCELLED" });
  expect(workers).toHaveLength(0);
  await client.dispose();
});
it("caps owners at two, retains both idle caches, and releases capacity after a crash", async () => {
  const { client, workers, context } = setup();
  for (const [n, dataDir] of ["/first", "/second"].entries()) {
    const request = client.methods.snapshot({}, { ...context, dataDir });
    workers[n]?.emit("message", { type: "result", id: n + 1, result: "ready" });
    await request;
  }
  await expect(
    client.methods.snapshot({}, { ...context, dataDir: "/third" }),
  ).rejects.toMatchObject({ code: "E_BACKEND_UNAVAILABLE" });
  expect(workers).toHaveLength(2);
  expect(Object.getPrototypeOf(client.methods)).toBeNull();
  workers[0]?.emit("exit", 1);
  const third = client.methods.snapshot({}, { ...context, dataDir: "/third" });
  workers[2]?.emit("message", { type: "result", id: 3, result: "ready" });
  await third;
  await client.dispose();
});

class StoppingWorker extends TestWorker {
  finishTermination: () => void = () => {};
  override terminate() {
    this.terminated = true;
    return new Promise<number>((resolve) => {
      this.finishTermination = () => resolve(1);
    });
  }
}
it("retains a failing physical owner until termination completes and dispose waits for it", async () => {
  const { client, workers, context } = setup(() => new StoppingWorker());
  const active = client.methods.execute({}, context);
  const queued = client.methods.snapshot({}, context);
  const rejected = Promise.all([
    expect(active).rejects.toMatchObject({ code: "E_BACKEND_CRASHED" }),
    expect(queued).rejects.toMatchObject({ code: "E_BACKEND_CRASHED" }),
  ]);
  const second = client.methods.snapshot({}, { ...context, dataDir: "/second" });
  workers[1]?.emit("message", { type: "result", id: 3, result: "ready" });
  await second;
  workers[0]?.emit("error", new Error("Worker failing inside native SQLite"));
  await rejected;
  await expect(client.methods.snapshot({}, context)).rejects.toMatchObject({
    code: "E_BACKEND_UNAVAILABLE",
  });
  await expect(
    client.methods.snapshot({}, { ...context, dataDir: "/third" }),
  ).rejects.toMatchObject({ code: "E_BACKEND_UNAVAILABLE" });
  workers[0]?.emit("message", { type: "result", id: 1, result: "late terminal" });
  workers[0]?.emit("message", { type: "progress", id: 1, fraction: 1 });
  await expect(client.methods.snapshot({}, context)).rejects.toMatchObject({
    code: "E_BACKEND_UNAVAILABLE",
  });
  expect(workers).toHaveLength(2);
  let disposed = false;
  const disposal = client.dispose().then(() => {
    disposed = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(disposed).toBe(false);
  const stopping = workers[0];
  if (!(stopping instanceof StoppingWorker)) throw new Error("Missing controlled worker");
  stopping.finishTermination(); // Fulfillment alone also confirms physical termination.
  await disposal;
  expect(disposed).toBe(true);
});
it("allows a new explicit owner after exit even while terminate fulfillment is delayed", async () => {
  const { client, workers, context } = setup(() => new StoppingWorker());
  const request = client.methods.snapshot({}, context);
  const rejected = expect(request).rejects.toMatchObject({ code: "E_BACKEND_CRASHED" });
  workers[0]?.emit("error", new Error("Worker failure"));
  await rejected;
  workers[0]?.emit("exit", 1);
  const next = client.methods.snapshot({}, context);
  expect(workers).toHaveLength(2);
  const old = workers[0];
  if (!(old instanceof StoppingWorker)) throw new Error("Missing controlled worker");
  old.finishTermination();
  await Promise.resolve();
  workers[1]?.emit("message", { type: "result", id: 2, result: "new owner" });
  expect(await next).toBe("new owner");
  await client.dispose();
});
it("bounds native file promises across cancelled jobs and crashes until their actual settlement", async () => {
  const { client, workers, context } = setup();
  const releases: (() => void)[] = [];
  const files = {
    readBytes: () =>
      new Promise<Uint8Array>((resolve) => {
        releases.push(() => resolve(new Uint8Array([42])));
      }),
    writeBytes: () =>
      new Promise<void>((resolve) => {
        releases.push(resolve);
      }),
  };
  for (let n = 0; n < 32; n++) {
    const controller = new AbortController();
    const request = client.methods.backupPrepare(
      {},
      { ...context, files, signal: controller.signal },
    );
    const cancelled = expect(request).rejects.toMatchObject({ code: "E_CANCELLED" });
    const worker = workers.at(-1);
    worker?.emit("message", {
      type: "file-call",
      id: n + 1,
      callId: n + 1,
      token: "owned",
      operation: n % 2 ? { op: "writeBytes", bytes: new Uint8Array([1]) } : { op: "readBytes" },
    });
    controller.abort();
    await cancelled;
    if (n === 15) {
      worker?.emit("error", new Error("Crash after cancellation with native files pending"));
      await Promise.resolve();
      await Promise.resolve();
    } else worker?.emit("message", { type: "error", id: n + 1, error: { code: "E_CANCELLED" } });
  }
  expect(workers).toHaveLength(2);
  expect(releases).toHaveLength(32);
  const next = client.methods.backupPrepare({}, { ...context, files });
  const worker = workers.at(-1);
  const call = (callId: number) =>
    worker?.emit("message", {
      type: "file-call",
      id: 33,
      callId,
      token: "owned",
      operation: { op: "readBytes" },
    });
  call(100);
  expect(releases).toHaveLength(32);
  expect(worker?.sent).toContainEqual({
    type: "file-result",
    id: 33,
    callId: 100,
    result: { ok: false, error: { code: "E_BACKEND_UNAVAILABLE" } },
  });
  // A capability from the dead worker frees one slot but cannot reply to its successor.
  releases[0]?.();
  await Promise.resolve();
  await Promise.resolve();
  expect(
    worker?.sent.filter((message) => (message as { type: string }).type === "file-result"),
  ).toHaveLength(1);
  call(101);
  expect(releases).toHaveLength(33);
  worker?.emit("message", { type: "result", id: 33, result: "finished" });
  await next;
  // Disposal waits for worker exit, never for an irreversible host capability stuck forever.
  await client.dispose();
  for (const release of releases) release();
  await Promise.resolve();
  await Promise.resolve();
  expect(
    worker?.sent.filter((message) => (message as { type: string }).type === "file-result"),
  ).toHaveLength(1);
});
