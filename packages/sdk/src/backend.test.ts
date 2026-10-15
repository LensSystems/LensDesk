import { describe, expect, it, vi } from "vitest";
import { createBackendRuntime, defineBackend } from "./backend.ts";
import { createTestContext } from "./backend-testing.ts";

type Message = { type: string; [key: string]: unknown };
function makePort() {
  let listener: (message: Message) => void = () => {};
  const messages: Message[] = [];
  return {
    port: {
      on: (_event: "message", callback: (message: Message) => void) => {
        listener = callback;
      },
      postMessage: (message: unknown) => messages.push(message as Message),
    },
    send: (message: Message) => listener(message),
    messages,
  };
}

describe("defineBackend", () => {
  it("exposes methods without a parent port", () => {
    const methods = { ping: () => "pong" };
    expect(defineBackend({ methods }).methods).toBe(methods);
  });

  it("returns results, maps thrown errors, and rejects missing methods", async () => {
    const { port, send, messages } = makePort();
    createBackendRuntime(
      {
        ping: () => "pong",
        fail: () => {
          throw Object.assign(new Error("bad"), { code: "E_INVALID_PARAMS" });
        },
      },
      port as never,
    );
    send({ type: "request", id: 1, method: "ping", params: null });
    send({ type: "request", id: 2, method: "fail", params: null });
    send({ type: "request", id: 3, method: "missing", params: null });
    await vi.waitFor(() => expect(messages).toHaveLength(3));
    expect(messages).toContainEqual({ type: "response", id: 1, result: "pong" });
    expect(messages).toContainEqual({
      type: "response",
      id: 2,
      error: { code: "E_INTERNAL", message: "bad" },
    });
    expect(messages).toContainEqual({
      type: "response",
      id: 3,
      error: { code: "E_METHOD_NOT_FOUND", message: "Unknown backend method: missing" },
    });
  });

  it("aborts ctx.signal and answers cancellation with E_CANCELLED", async () => {
    const { port, send, messages } = makePort();
    let sawAbort = false;
    createBackendRuntime(
      {
        wait: (_params, ctx) => {
          ctx.signal.addEventListener("abort", () => {
            sawAbort = ctx.signal.aborted;
          });
          return new Promise(() => {});
        },
      },
      port as never,
    );
    send({ type: "request", id: "cancel-me", method: "wait", params: null });
    await Promise.resolve();
    send({ type: "cancel", id: "cancel-me" });
    await vi.waitFor(() =>
      expect(messages).toContainEqual({
        type: "response",
        id: "cancel-me",
        error: { code: "E_CANCELLED", message: "Request cancelled" },
      }),
    );
    expect(sawAbort).toBe(true);
  });

  it("sends the exact progress message shape", async () => {
    const { port, send, messages } = makePort();
    createBackendRuntime(
      {
        progress: (_params, ctx) => {
          ctx.progress(0.4, "Working");
          return "ok";
        },
      },
      port as never,
    );
    send({ type: "request", id: "p-1", method: "progress", params: null });
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(messages[0]).toEqual({ type: "progress", id: "p-1", fraction: 0.4, message: "Working" });
  });

  it("round trips files through file-call and file-result, including errors", async () => {
    const { port, send, messages } = makePort();
    createBackendRuntime(
      {
        read: async (_params, ctx) => Array.from(await ctx.files.readBytes("read-token")),
        write: async (_params, ctx) => {
          await ctx.files.writeBytes("write-token", new Uint8Array([4, 5]));
          return "written";
        },
        fail: async (_params, ctx) => ctx.files.readBytes("denied"),
      },
      port as never,
    );
    send({ type: "request", id: 1, method: "read", params: null });
    await vi.waitFor(() => expect(messages[0]?.type).toBe("file-call"));
    const readCall = messages[0];
    expect(readCall).toMatchObject({
      type: "file-call",
      callId: 1,
      op: "readBytes",
      token: "read-token",
    });
    send({ type: "file-result", callId: 1, ok: true, data: new Uint8Array([8, 9]) });
    await vi.waitFor(() =>
      expect(messages).toContainEqual({ type: "response", id: 1, result: [8, 9] }),
    );

    send({ type: "request", id: 2, method: "write", params: null });
    await vi.waitFor(() =>
      expect(messages.some((message) => message.op === "writeBytes")).toBe(true),
    );
    const writeCall = messages.find((message) => message.op === "writeBytes");
    expect(writeCall).toMatchObject({
      type: "file-call",
      callId: 2,
      op: "writeBytes",
      token: "write-token",
      bytes: new Uint8Array([4, 5]),
    });
    send({ type: "file-result", callId: 2, ok: true });
    await vi.waitFor(() =>
      expect(messages).toContainEqual({ type: "response", id: 2, result: "written" }),
    );

    send({ type: "request", id: 3, method: "fail", params: null });
    await vi.waitFor(() =>
      expect(
        messages.some((message) => message.type === "file-call" && message.token === "denied"),
      ).toBe(true),
    );
    send({
      type: "file-result",
      callId: 3,
      ok: false,
      error: { code: "E_PATH_NOT_GRANTED", message: "No access" },
    });
    await vi.waitFor(() =>
      expect(messages).toContainEqual({
        type: "response",
        id: 3,
        error: { code: "E_PATH_NOT_GRANTED", message: "No access" },
      }),
    );
  });

  it("provides the complete isolated test context", async () => {
    const ctx = createTestContext({ dataDir: "/tmp/tool-data" });
    expect(ctx.dataDir).toBe("/tmp/tool-data");
    await ctx.files.writeBytes("token", new Uint8Array([1, 2]));
    expect(ctx.fileBytes.get("token")).toEqual(new Uint8Array([1, 2]));
    expect(await ctx.files.readBytes("token")).toEqual(new Uint8Array([1, 2]));
    ctx.progress(0.5, "half");
    expect(ctx.progressEvents).toEqual([{ fraction: 0.5, message: "half" }]);
    ctx.log.info("ready");
    ctx.log.warn("warning");
    ctx.log.error("failed");
    expect(ctx.logs).toEqual([
      { level: "info", message: "ready" },
      { level: "warn", message: "warning" },
      { level: "error", message: "failed" },
    ]);
    expect(ctx.signal.aborted).toBe(false);
  });
});
