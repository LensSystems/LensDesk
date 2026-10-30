import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Note } from "./NoteList.tsx";
import { usePublicSaves } from "./use-public-saves.ts";

const note = (id: string, body_md = "Original"): Note => ({
  id,
  body_md,
  title: id,
  pinned: false,
  created_at: "now",
  updated_at: "now",
  deleted_at: null,
});

it("no escribe una cola pública ni aplica su respuesta si la nota ya es privada", async () => {
  let release = () => {};
  const client = {
    backend: {
      invoke: vi.fn(
        () =>
          new Promise<Note>((resolve) => {
            release = () => resolve(note("one", "PUBLIC_A"));
          }),
      ),
    },
  };
  const notes = { current: [note("one")] };
  const { result } = renderHook(() =>
    usePublicSaves(client as never, notes, { current: new Map() }, vi.fn(), vi.fn()),
  );
  act(() => {
    void result.current.save("one", "PUBLIC_A");
    void result.current.save("one", "PUBLIC_B");
  });
  notes.current = [{ ...note("one", ""), private: true }];
  await act(async () => release());
  expect(client.backend.invoke).toHaveBeenCalledTimes(1);
  expect(notes.current[0]?.body_md).toBe("");
});

it("esperar la cola incluye escrituras añadidas mientras espera", async () => {
  const releases: (() => void)[] = [];
  const client = {
    backend: {
      invoke: vi.fn(
        (_method: string, params: { body_md: string }) =>
          new Promise<Note>((resolve) => {
            releases.push(() => resolve(note("one", params.body_md)));
          }),
      ),
    },
  };
  const { result } = renderHook(() =>
    usePublicSaves(
      client as never,
      { current: [note("one")] },
      { current: new Map() },
      vi.fn(),
      vi.fn(),
    ),
  );
  let settled = false;
  act(() => {
    void result.current.save("one", "A");
    void result.current.settle("one").then(() => {
      settled = true;
    });
    void result.current.save("one", "B");
  });
  await act(async () => releases[0]?.());
  expect(releases).toHaveLength(2);
  expect(settled).toBe(false);
  await act(async () => releases[1]?.());
  expect(settled).toBe(true);
});

it.each([false, true])(
  "edita A→B→A y solo confirma la última versión; B falla=%s",
  async (failure) => {
    const requests: { body: string; done: () => void }[] = [];
    const client = {
      backend: {
        invoke: vi.fn(
          (_method: string, params: { body_md: string }) =>
            new Promise<Note>((resolve, reject) => {
              requests.push({
                body: params.body_md,
                done: () =>
                  params.body_md === "B" && failure
                    ? reject(new Error("synthetic"))
                    : resolve(note("one", params.body_md)),
              });
            }),
        ),
      },
    };
    const notes = { current: [note("one")] },
      drafts = { current: new Map<string, string>() };
    const { result } = renderHook(() =>
      usePublicSaves(client as never, notes, drafts, vi.fn(), vi.fn()),
    );
    const edit = (body: string) => {
      drafts.current.set("one", body);
      act(() => result.current.edit("one"));
    };
    edit("A");
    act(() => {
      void result.current.save("one", "A");
    });
    expect(result.current.states.one).toBe("saving");
    edit("B");
    act(() => {
      void result.current.save("one", "B");
    });
    edit("A");
    act(() => {
      void result.current.save("one", "A");
    });
    expect(requests).toHaveLength(1);
    expect(result.current.states.one).toBe("pending");
    await act(async () => requests[0]?.done());
    expect(requests.map((request) => request.body)).toEqual(["A", "B"]);
    expect(result.current.states.one).toBe("pending");
    expect(drafts.current.get("one")).toBe("A");
    await act(async () => requests[1]?.done());
    expect(requests.map((request) => request.body)).toEqual(["A", "B", "A"]);
    expect(result.current.states.one).toBe("saving");
    await act(async () => requests[2]?.done());
    expect(result.current.states.one).toBe("saved");
    expect(notes.current[0]?.body_md).toBe("A");
  },
);

it("un fallo tardío de otra nota no borra el guardado actual", async () => {
  let fail!: () => void;
  const client = {
    backend: {
      invoke: vi.fn((_method: string, params: { id: string; body_md: string }) =>
        params.id === "one"
          ? new Promise<Note>((_, reject) => {
              fail = () => reject(new Error("synthetic"));
            })
          : Promise.resolve(note(params.id, params.body_md)),
      ),
    },
  };
  const { result } = renderHook(() =>
    usePublicSaves(
      client as never,
      { current: [note("one"), note("two")] },
      { current: new Map() },
      vi.fn(),
      vi.fn(),
    ),
  );
  act(() => {
    result.current.edit("one");
    void result.current.save("one", "A");
  });
  await act(async () => {
    result.current.edit("two");
    await result.current.save("two", "B");
  });
  expect(result.current.states.two).toBe("saved");
  await act(async () => fail());
  expect(result.current.states.one).toBe("error");
  expect(result.current.states.two).toBe("saved");
});

it("volver al cuerpo confirmado sin escribir termina limpio, sin un Guardado falso", async () => {
  const client = { backend: { invoke: vi.fn() } };
  const notes = { current: [note("one")] },
    drafts = { current: new Map<string, string>() };
  const { result } = renderHook(() =>
    usePublicSaves(client as never, notes, drafts, vi.fn(), vi.fn()),
  );
  act(() => {
    result.current.edit("one");
    result.current.edit("one");
    void result.current.save("one", "Original");
  });
  expect(result.current.states.one).toBe("idle");
  expect(client.backend.invoke).not.toHaveBeenCalled();
});

it("reintenta tras una respuesta fallida aunque la recarga ya muestre el borrador, sin duplicar la petición en vuelo", async () => {
  let persisted = note("one");
  let confirm = () => {};
  const invoke = vi.fn(async (_method: string, params: { body_md: string }) => {
    persisted = note("one", params.body_md);
    if (invoke.mock.calls.length === 1) throw new Error("Falló la respuesta del guardado");
    return new Promise<Note>((resolve) => {
      confirm = () => resolve(persisted);
    });
  });
  const notes = { current: [note("one")] };
  const drafts = { current: new Map([["one", "Borrador"]]) };
  const { result, rerender } = renderHook(() =>
    usePublicSaves({ backend: { invoke } } as never, notes, drafts, vi.fn(), vi.fn()),
  );
  await act(async () => {
    result.current.edit("one");
    await result.current.save("one", "Borrador");
  });
  expect(result.current.states.one).toBe("error");
  expect(drafts.current.get("one")).toBe("Borrador");
  notes.current = [{ ...persisted }];
  rerender();
  expect(result.current.states.one).toBe("error");
  let first: Promise<void> | undefined;
  act(() => {
    first = result.current.save("one", "Borrador", true);
  });
  expect(invoke).toHaveBeenCalledTimes(2);
  act(() => {
    expect(result.current.save("one", "Borrador", true)).toBe(first);
  });
  expect(invoke).toHaveBeenLastCalledWith("update", { id: "one", body_md: "Borrador" });
  expect(result.current.states.one).toBe("saving");
  expect(drafts.current.get("one")).toBe("Borrador");
  await act(async () => confirm());
  expect(result.current.states.one).toBe("saved");
  expect(drafts.current.has("one")).toBe(false);
});
