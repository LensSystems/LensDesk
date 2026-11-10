import { execFile } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, it } from "vitest";
import { preparedSchema } from "../shared/backup-contracts.ts";
import { encode } from "./backup-json.ts";
import { openVentasDatabase } from "./db/driver.ts";
import { largeNative } from "./worker-native-fixture.ts";
import { rpc, until, workerBundles } from "./worker-test-harness.ts";
import { largeWeb } from "./worker-web-fixture.ts";

let bundles: Awaited<ReturnType<typeof workerBundles>>;
beforeAll(async () => {
  bundles = await workerBundles();
}, 30000);
afterAll(() => {
  if (bundles) rmSync(bundles.dir, { recursive: true, force: true });
});

for (const format of ["web10000", "native20MiB"] as const) {
  it(`responds to RPC cancellation during a real >1000ms COMMIT of ${format}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "ventas-worker-rpc-"));
    const fixtureDb = openVentasDatabase(dir);
    const bytes = format === "web10000" ? encode(largeWeb(10000)) : largeNative(fixtureDb).bytes;
    const indexes = fixtureDb.all(
      "SELECT name,sql FROM sqlite_schema WHERE type='index' ORDER BY name",
    );
    fixtureDb.close();
    const buffer = new SharedArrayBuffer(16),
      trace = new Int32Array(buffer);
    const runtime = rpc(dir, bundles.slow, buffer);
    runtime.input(bytes);
    try {
      const prepared = await runtime.request("backupPrepare", {
        token: "input",
        name: "large.json",
      }).response;
      expect(prepared.error).toBeUndefined();
      const p = preparedSchema.parse((prepared.result as { value: unknown }).value);
      const request = { id: p.id, hash: p.hash, revision: p.revision, key: crypto.randomUUID() };
      const restore = runtime.request("confirmRestore", request);
      await until(() => Atomics.load(trace, 0) === 1, 20000);
      expect(Atomics.load(trace, 1)).toBe(0);
      const cancelStart = performance.now();
      runtime.cancel(restore.id);
      const cancelled = await restore.response;
      const responseMs = performance.now() - cancelStart;
      expect(cancelled.error?.code).toBe("E_CANCELLED");
      expect(responseMs).toBeLessThan(1000);
      // The response is delivered while SQLite is still physically committing.
      expect(Atomics.load(trace, 1)).toBe(0);
      let completed = false;
      const snapshot = runtime.request("snapshot").response.then((result) => {
        completed = true;
        return result;
      });
      let mutationCompleted = false;
      const mutation = runtime
        .request("execute", {
          key: crypto.randomUUID(),
          revision: p.revision,
          action: { type: "openCash", initial: 0 },
        })
        .response.then((result) => {
          mutationCompleted = true;
          return result;
        });
      const queued = runtime.request("backupPrepare", { token: "forbidden", name: "never.json" });
      runtime.cancel(queued.id);
      expect((await queued.response).error?.code).toBe("E_CANCELLED");
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(completed).toBe(false);
      expect(mutationCompleted).toBe(false);
      const state = await snapshot;
      expect(state.error).toBeUndefined();
      expect((await mutation).result).toMatchObject({
        kind: "rejected",
        issue: { code: "E_REVISION" },
      });
      expect(Atomics.load(trace, 2)).toBeGreaterThanOrEqual(1500);
      expect(Atomics.load(trace, 1)).toBe(1);
      expect(runtime.messages).not.toContainEqual(
        expect.objectContaining({ type: "file-call", token: "forbidden" }),
      );
      const replay = await runtime.request("confirmRestore", request).response;
      expect(replay.result).toMatchObject({ kind: "ok", value: { revision: p.revision + 1 } });
      // A crash must not replay automatically; an explicit retry reconciles the durable receipt.
      await runtime.workers[0]?.terminate();
      await until(() => runtime.workers[0]?.threadId === -1);
      const recovered = await runtime.request("confirmRestore", request).response;
      expect(recovered.result).toEqual(replay.result);
      expect(runtime.workers).toHaveLength(2);
      const check = openVentasDatabase(dir);
      try {
        expect(check.all("SELECT * FROM restore_receipts")).toHaveLength(1);
        expect(
          check.all("SELECT name,sql FROM sqlite_schema WHERE type='index' ORDER BY name"),
        ).toEqual(indexes);
        expect(check.get<{ revision: number }>("SELECT revision FROM meta")?.revision).toBe(
          p.revision + 1,
        );
        expect(check.get<{ synchronous: number }>("PRAGMA synchronous")?.synchronous).toBe(2);
        expect(check.get<{ journal_mode: string }>("PRAGMA journal_mode")?.journal_mode).toBe(
          "wal",
        );
        expect(check.get<{ n: number }>("SELECT COUNT(*) n FROM products")?.n).toBe(
          format === "web10000" ? 10000 : 1,
        );
      } finally {
        check.close();
      }
      console.log(
        JSON.stringify({
          format,
          bytes: bytes.length,
          responseMs,
          commitMs: Atomics.load(trace, 2),
        }),
      );
    } finally {
      await runtime.client.dispose();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 40000);
}

it("ships one self-contained ESM backend and bridges capabilities through the real worker", async () => {
  expect(readdirSync(join(bundles.dir, "real")).sort()).toEqual(["index.js", "package.json"]);
  const dir = mkdtempSync(join(tmpdir(), "ventas-worker-real-"));
  const runtime = rpc(dir, bundles.real);
  try {
    expect((await runtime.request("snapshot").response).result).toMatchObject({ kind: "ok" });
    expect(
      (await runtime.request("backupPrepare", { token: "unknown", name: "x" }).response).error
        ?.code,
    ).toBe("E_PATH_NOT_GRANTED");
    runtime.input(encode(largeWeb(1)));
    const prepared = await runtime.request("backupPrepare", { token: "input", name: "x" }).response;
    expect(prepared.result).toMatchObject({ kind: "ok" });
    runtime.output();
    expect(
      (await runtime.request("backupExport", { token: "output" }).response).result,
    ).toMatchObject({ kind: "ok" });
    expect(runtime.files.get("output")?.bytes.length).toBeGreaterThan(0);
    expect(
      (
        await runtime.request("execute", { dataDir: "/forbidden", sql: "DELETE FROM products" })
          .response
      ).error?.code,
    ).toBe("E_INVALID_PARAMS");
  } finally {
    await runtime.client.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("starts a self-worker from the actual production bundle entry", async () => {
  const backend = await import(/* @vite-ignore */ bundles.real.href);
  const dir = mkdtempSync(join(tmpdir(), "ventas-self-worker-"));
  const context = rpc(dir, bundles.real);
  try {
    expect(await backend.methods.snapshot({}, context.ctx)).toMatchObject({ kind: "ok" });
  } finally {
    await backend.dispose();
    await context.client.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("aborts a pending real-worker file read and ignores its late response", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ventas-worker-file-cancel-"));
  const runtime = rpc(dir, bundles.real);
  let read = false;
  let finish: (bytes: Uint8Array) => void = () => {};
  runtime.ctx.files.readBytes = () =>
    new Promise((resolve) => {
      read = true;
      finish = resolve;
    });
  try {
    const prepare = runtime.request("backupPrepare", { token: "waiting", name: "x" });
    await until(() => read);
    const start = performance.now();
    runtime.cancel(prepare.id);
    expect((await prepare.response).error?.code).toBe("E_CANCELLED");
    expect(performance.now() - start).toBeLessThan(1000);
    expect((await runtime.request("snapshot").response).result).toMatchObject({
      kind: "ok",
      value: { revision: 0 },
    });
    finish(encode(largeWeb(1)));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await runtime.request("backupInfo").response).result).toMatchObject({
      kind: "ok",
      value: { previous: false },
    });
  } finally {
    await runtime.client.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("rejects an active real-worker crash and its queue without retrying the pending work", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ventas-worker-crash-"));
  const runtime = rpc(dir, bundles.real);
  let reads = 0;
  runtime.ctx.files.readBytes = () => {
    reads++;
    return new Promise(() => {});
  };
  try {
    const prepare = runtime.request("backupPrepare", { token: "waiting", name: "x" });
    await until(() => reads === 1);
    const queued = runtime.request("execute", {
      key: crypto.randomUUID(),
      revision: 0,
      action: { type: "openCash", initial: 0 },
    });
    await runtime.workers[0]?.terminate();
    expect((await prepare.response).error?.code).toBe("E_BACKEND_CRASHED");
    expect((await queued.response).error?.code).toBe("E_BACKEND_CRASHED");
    expect(runtime.workers).toHaveLength(1);
    expect((await runtime.request("snapshot").response).result).toMatchObject({
      kind: "ok",
      value: { revision: 0, cash: null },
    });
    expect(runtime.workers).toHaveLength(2);
    expect(reads).toBe(1);
  } finally {
    await runtime.client.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("reconciles an execute mutation cancelled during COMMIT using the original key", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ventas-execute-rpc-"));
  const buffer = new SharedArrayBuffer(16),
    trace = new Int32Array(buffer);
  const runtime = rpc(dir, bundles.slow, buffer);
  try {
    const command = {
      key: crypto.randomUUID(),
      revision: 0,
      action: { type: "openCash", initial: 0 },
    };
    const mutation = runtime.request("execute", command);
    await until(() => Atomics.load(trace, 0) === 1);
    const start = performance.now();
    runtime.cancel(mutation.id);
    expect((await mutation.response).error?.code).toBe("E_CANCELLED");
    expect(performance.now() - start).toBeLessThan(1000);
    expect(Atomics.load(trace, 1)).toBe(0);
    const replay = await runtime.request("execute", command).response;
    expect(replay.result).toMatchObject({ kind: "ok", value: { revision: 1 } });
    expect(Atomics.load(trace, 2)).toBeGreaterThanOrEqual(1500);
    expect((await runtime.request("execute", command).response).result).toEqual(replay.result);
    expect((await runtime.request("snapshot").response).result).toMatchObject({
      kind: "ok",
      value: { revision: 1 },
    });
  } finally {
    await runtime.client.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
});

it("allows a process with an idle database worker to exit without disposal", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ventas-worker-idle-"));
  try {
    const source = `
      const backend = await import(${JSON.stringify(bundles.real.href)});
      const context = { dataDir: ${JSON.stringify(dir)}, signal: new AbortController().signal,
        files: {}, progress() {}, log: {} };
      const result = await backend.methods.snapshot({}, context);
      console.log(result.kind);
    `;
    const result = await promisify(execFile)(
      process.execPath,
      ["--input-type=module", "-e", source],
      { timeout: 5000 },
    );
    expect(result.stdout.trim()).toBe("ok");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
