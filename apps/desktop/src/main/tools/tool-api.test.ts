import { describe, expect, it, vi } from "vitest";
import { createFileTokens } from "./file-tokens.ts";
import { createToolApi } from "./tool-api.ts";

function fixture(permissions = ["storage"], extra: Record<string, unknown> = {}) {
  const rows = new Map<string, { value_json: string; updated_at: string }>();
  const db = {
    prepare: vi.fn((sql: string) => ({
      get: (...params: unknown[]) =>
        sql.startsWith("SELECT value_json")
          ? rows.get(`${params[0]}:${params[1]}`)
            ? { value_json: rows.get(`${params[0]}:${params[1]}`)?.value_json }
            : undefined
          : undefined,
      all: (id: string) =>
        [...rows.keys()]
          .filter((key) => key.startsWith(`${id}:`))
          .map((key) => ({ key: key.slice(id.length + 1) })),
      run: (...params: unknown[]) => {
        if (sql.startsWith("INSERT"))
          rows.set(`${params[0]}:${params[1]}`, {
            value_json: String(params[2]),
            updated_at: String(params[3]),
          });
        if (sql.startsWith("DELETE")) rows.delete(`${params[0]}:${params[1]}`);
      },
    })),
  } as never;
  const view = { webContents: { id: 5, send: vi.fn() } };
  const api = createToolApi({
    registry: {
      get: () => ({ id: "test-tool", version: "1.2.3", enabled: true, manifest: { permissions } }),
    },
    db,
    context: () => ({ locale: "es", theme: "dark" }),
    views: () => [view],
    viewId: (id) => (id === 5 ? "test-tool" : undefined),
    hostVersion: "0.1.0",
    clipboard: vi.fn(),
    openExternal: vi.fn(async () => undefined),
    fileTokens: createFileTokens({ createId: () => "file-token" }),
    dialog: {
      showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
      showSaveDialog: vi.fn(async () => ({ canceled: true })),
    },
    ...extra,
  });
  return { api, view };
}
function errorCode(result: Awaited<ReturnType<ReturnType<typeof fixture>["api"]["invoke"]>>) {
  return result.ok ? undefined : result.error.code;
}

describe("tool API", () => {
  it("scopes storage to the sender and enforces permission, key and byte limits", async () => {
    const { api } = fixture();
    expect(await api.invoke({ id: 5 }, "storage.set", { key: "a", value: { n: 1 } })).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await api.invoke({ id: 5 }, "storage.get", { key: "a" })).toEqual({
      ok: true,
      data: { n: 1 },
    });
    expect(errorCode(await api.invoke({ id: 99 }, "storage.get", { key: "a" }))).toBe(
      "E_PERMISSION_DENIED",
    );
    expect(errorCode(await api.invoke({ id: 5 }, "storage.get", { key: "x".repeat(257) }))).toBe(
      "E_INVALID_PARAMS",
    );
    expect(
      errorCode(
        await api.invoke({ id: 5 }, "storage.set", { key: "big", value: "x".repeat(1024 * 1024) }),
      ),
    ).toBe("E_TOO_LARGE");
    expect(errorCode(await api.invoke({ id: 5 }, "storage.set", { key: "nada" }))).toBe(
      "E_INVALID_PARAMS",
    );
    expect(
      errorCode(
        await api.invoke({ id: 5 }, "ui.toast", { kind: "info", message: "x".repeat(501) }),
      ),
    ).toBe("E_INVALID_PARAMS");
    const denied = fixture([]).api;
    expect(errorCode(await denied.invoke({ id: 5 }, "storage.get", { key: "a" }))).toBe(
      "E_PERMISSION_DENIED",
    );
    expect(errorCode(await denied.invoke({ id: 5 }, "storage.delete", { key: "a" }))).toBe(
      "E_PERMISSION_DENIED",
    );
    expect(errorCode(await denied.invoke({ id: 5 }, "storage.keys", {}))).toBe(
      "E_PERMISSION_DENIED",
    );
  });

  it("adds tool context and rejects non-HTTPS external URLs", async () => {
    const { api, view } = fixture();
    expect(await api.invoke({ id: 5 }, "app.getContext", {})).toEqual({
      ok: true,
      data: { locale: "es", theme: "dark", hostVersion: "0.1.0", toolVersion: "1.2.3" },
    });
    api.publishContext({ locale: "en", theme: "light" });
    expect(view.webContents.send).toHaveBeenCalledWith(
      "lensdesk:tool-event:app.contextChanged",
      expect.objectContaining({ locale: "en", toolVersion: "1.2.3" }),
    );
    expect(
      errorCode(await api.invoke({ id: 5 }, "ui.openExternal", { url: "http://example.com" })),
    ).toBe("E_INVALID_PARAMS");
  });

  it("enforces backend permission, validates requests and scopes progress to its view", async () => {
    const backend = {
      invoke: vi.fn(async (_id, _requestId, _method, _params, progress) => {
        progress({ fraction: 0.5 });
        return { pong: true };
      }),
      cancel: vi.fn(),
    };
    const { api, view } = fixture(["backend"], { backend });
    expect(
      await api.invoke({ id: 5 }, "backend.invoke", {
        requestId: "r1",
        method: "ping",
        params: {},
      }),
    ).toEqual({ ok: true, data: { pong: true } });
    expect(view.webContents.send).toHaveBeenCalledWith("lensdesk:tool-event:backend.progress", {
      fraction: 0.5,
      requestId: "r1",
    });
    expect(
      await api.invoke({ id: 5 }, "backend.invoke", { requestId: "", method: "ping", params: {} }),
    ).toMatchObject({ ok: false, error: { code: "E_INVALID_PARAMS" } });
    expect(await api.invoke({ id: 5 }, "backend.cancel", { requestId: "r1" })).toMatchObject({
      ok: true,
    });
    expect(backend.cancel).toHaveBeenCalledWith("test-tool", "r1");
    const denied = fixture([]).api;
    expect(
      await denied.invoke({ id: 5 }, "backend.invoke", {
        requestId: "r",
        method: "ping",
        params: {},
      }),
    ).toMatchObject({ ok: false, error: { code: "E_PERMISSION_DENIED" } });
  });

  it("grants read/write tokens only through files APIs and checks the files permission", async () => {
    const contents = Buffer.from("hello");
    const fileTokens = createFileTokens({ createId: () => "read-token" });
    const dialog = {
      showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: ["/safe/file.txt"] })),
      showSaveDialog: vi.fn(async () => ({ canceled: true })),
    };
    const fs = {
      lstat: vi.fn(async () => ({ isFile: () => true })),
      stat: vi.fn(async () => ({ isFile: () => true, size: 5 })),
      readFile: vi.fn(async () => contents),
      writeFile: vi.fn(async () => undefined),
    };
    const { api } = fixture(["files"], { fileTokens, dialog, fs });
    const picked = await api.invoke({ id: 5 }, "files.pickOpen", { multiple: false });
    expect(picked).toEqual({
      ok: true,
      data: [{ token: "read-token", name: "file.txt", size: 5 }],
    });
    expect(JSON.stringify(picked)).not.toContain("/safe/file.txt");
    expect(await api.invoke({ id: 5 }, "files.readText", { token: "read-token" })).toEqual({
      ok: true,
      data: "hello",
    });
    expect(
      errorCode(
        await api.invoke({ id: 5 }, "files.writeText", { token: "read-token", text: "no" }),
      ),
    ).toBe("E_PATH_NOT_GRANTED");
    expect(errorCode(await api.invoke({ id: 5 }, "files.readText", { token: "other" }))).toBe(
      "E_PATH_NOT_GRANTED",
    );
    const denied = fixture([]).api;
    expect(errorCode(await denied.invoke({ id: 5 }, "files.pickOpen", {}))).toBe(
      "E_PERMISSION_DENIED",
    );
  });
});
