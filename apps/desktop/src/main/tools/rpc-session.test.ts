import { describe, expect, it, vi } from "vitest";
import { createFileTokens } from "./file-tokens.ts";
import { createRpcSession } from "./rpc-session.ts";

function fixture(
  resolveFile: (
    op: string,
    token: string,
    bytes?: Uint8Array,
  ) => Promise<Uint8Array | undefined> = vi.fn(async () => new Uint8Array([7])),
) {
  let listener: ((message: { type: string; [key: string]: unknown }) => void) | undefined;
  const sent: Record<string, unknown>[] = [];
  const port = {
    postMessage: vi.fn((message: Record<string, unknown>) => sent.push(message)),
    on: vi.fn((_event: string, callback: typeof listener) => {
      listener = callback;
    }),
  };
  const session = createRpcSession({ port, resolveFile });
  return {
    session,
    sent,
    receive: (message: { type: string; [key: string]: unknown }) => listener?.(message),
    resolveFile,
  };
}

describe("RPC backend session", () => {
  it("asigna ids diferentes y dirige progress a la llamada correspondiente", async () => {
    const f = fixture();
    const progress = vi.fn();
    const a = f.session.invoke("a", {}, progress);
    const b = f.session.invoke("b", {});
    expect(f.sent.map((message) => message.id)).toEqual([1, 2]);
    f.receive({ type: "progress", id: 2, fraction: 0.5 });
    expect(progress).not.toHaveBeenCalled();
    f.receive({ type: "progress", id: 1, fraction: 0.7, message: "trabajando" });
    expect(progress).toHaveBeenCalledWith({ fraction: 0.7, message: "trabajando" });
    f.receive({ type: "response", id: 1, result: "ok" });
    f.receive({ type: "response", id: 2, result: "done" });
    await expect(a.promise).resolves.toBe("ok");
    await expect(b.promise).resolves.toBe("done");
  });

  it("envía cancel y responde E_CANCELLED cuando llega la respuesta", async () => {
    const f = fixture();
    const call = f.session.invoke("slow", {});
    f.session.cancel(call.id);
    expect(f.sent[1]).toEqual({ type: "cancel", id: call.id });
    f.receive({
      type: "response",
      id: call.id,
      error: { code: "E_CANCELLED", message: "cancelado" },
    });
    await expect(call.promise).rejects.toMatchObject({ code: "E_CANCELLED" });
  });

  it("resuelve file-call y devuelve file-result; conserva E_PATH_NOT_GRANTED", async () => {
    const tokens = createFileTokens({
      createId: (() => {
        let id = 0;
        return () => `token-${++id}`;
      })(),
    });
    const own = tokens.grant("tool-a", "/private/a", "read");
    const foreign = tokens.grant("tool-b", "/private/b", "read");
    const resolveFile = vi.fn(async (_op: string, token: string) => {
      tokens.resolve("tool-a", token, "read", "backend.files.readBytes");
      return new Uint8Array([1, 2]);
    });
    const f = fixture(resolveFile);
    f.receive({ type: "file-call", callId: 1, op: "readBytes", token: own });
    f.receive({ type: "file-call", callId: 2, op: "readBytes", token: foreign });
    await vi.waitFor(() => expect(f.sent).toHaveLength(2));
    expect(f.sent[0]).toMatchObject({
      type: "file-result",
      callId: 1,
      ok: true,
      data: new Uint8Array([1, 2]),
    });
    expect(f.sent[1]).toMatchObject({
      type: "file-result",
      callId: 2,
      ok: false,
      error: { code: "E_PATH_NOT_GRANTED" },
    });
  });

  it("close rechaza pendientes y las llamadas posteriores no quedan colgadas", async () => {
    const f = fixture();
    const first = f.session.invoke("slow", {});
    f.session.close();
    await expect(first.promise).rejects.toMatchObject({ code: "E_BACKEND_CRASHED" });
    const second = f.session.invoke("later", {});
    await expect(second.promise).rejects.toMatchObject({ code: "E_BACKEND_CRASHED" });
  });
});
