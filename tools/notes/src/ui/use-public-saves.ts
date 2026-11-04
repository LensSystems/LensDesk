import type { createToolClient } from "@lensdesk/sdk";
import { type Dispatch, type SetStateAction, useCallback, useRef } from "react";
import type { Note } from "./NoteList.tsx";
import { errorCode } from "./use-failure.ts";
import { useSaveStatus } from "./use-save-status.ts";

export function usePublicSaves(
  client: ReturnType<typeof createToolClient>,
  notes: { current: Note[] },
  drafts: { current: Map<string, string> },
  setNotes: Dispatch<SetStateAction<Note[]>>,
  recover: (id: string, body: string) => Promise<Note>,
) {
  const { states, mark, edit, version, phase } = useSaveStatus();
  const pending = useRef(
    new Map<string, { value: string; version: number; promise: Promise<void> }>(),
  );
  const recovered = useRef(new Set<string>());
  const save = useCallback(
    function savePublic(id: string, value: string, retry = false): Promise<void> {
      const known = notes.current.find((note) => note.id === id);
      if (known?.private || (!retry && phase(id) === "error")) return Promise.resolve();
      const at = version(id);
      const previous = pending.current.get(id);
      if (previous?.value === value && previous.version === at) return previous.promise;
      if (!retry && !previous && known?.body_md === value) {
        if (phase(id) === "pending") mark(id, at, "idle");
        return Promise.resolve();
      }
      const persist = async () => {
        if (
          recovered.current.has(id) ||
          notes.current.some((note) => note.id === id && note.private)
        )
          return;
        mark(id, at, "saving");
        try {
          const updated = await client.backend.invoke<Note>("update", { id, body_md: value });
          if (notes.current.some((note) => note.id === id && note.private)) return;
          if (version(id) === at && drafts.current.get(id) === value) drafts.current.delete(id);
          notes.current = notes.current.map((note) =>
            note.id === id
              ? { ...note, body_md: updated.body_md, updated_at: updated.updated_at }
              : note,
          );
          setNotes(notes.current);
          mark(id, at, "saved");
        } catch (reason) {
          if (notes.current.some((note) => note.id === id && note.private)) return;
          if (errorCode(reason) === "E_NOT_FOUND") {
            try {
              const restored = await recover(id, drafts.current.get(id) ?? value);
              const latest = drafts.current.get(id) ?? restored.body_md;
              recovered.current.add(id);
              drafts.current.delete(id);
              if (latest !== restored.body_md) {
                drafts.current.set(restored.id, latest);
                edit(restored.id);
                void savePublic(restored.id, latest, true);
              } else mark(restored.id, version(restored.id), "saved");
            } catch {
              mark(id, at, "error");
            }
          } else mark(id, at, "error");
        }
      };
      const promise = previous ? previous.promise.then(persist) : persist();
      pending.current.set(id, { value, version: at, promise });
      void promise.finally(() => {
        if (pending.current.get(id)?.promise === promise) pending.current.delete(id);
      });
      return promise;
    },
    [client, notes, drafts, setNotes, recover, mark, version, phase, edit],
  );
  const settle = useCallback(async (id: string) => {
    let operation = pending.current.get(id);
    while (operation) {
      await operation.promise;
      operation = pending.current.get(id);
    }
  }, []);
  return { save, edit, states, settle };
}
