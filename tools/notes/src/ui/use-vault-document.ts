import type { createToolClient } from "@lensdesk/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Note } from "./NoteList.tsx";
import { errorCode } from "./use-failure.ts";
import { useSaveStatus } from "./use-save-status.ts";

type Client = ReturnType<typeof createToolClient>;
export function useVaultDocument(
  client: Client,
  note: Note | null,
  publicBody: string,
  unlocked: boolean,
  onLock: () => void,
) {
  const { t } = useTranslation();
  const { states, edit, resetAll, mark, version, phase } = useSaveStatus();
  const [loaded, setLoaded] = useState<{ id: string; body: string } | null>(null);
  const [body, updateBody] = useState("");
  const [message, setMessage] = useState("");
  // Solo memoria de esta instancia; nunca storage ni disco.
  const drafts = useRef(new Map<string, string>());
  const writes = useRef(new Map<string, Promise<void>>());
  const alive = useRef(true);
  const epoch = useRef(0);
  const current = useRef({ note, loaded, body, publicBody });
  current.current = { note, loaded, body, publicBody };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      drafts.current.clear();
      writes.current.clear();
      epoch.current++;
    };
  }, []);
  const setBody = useCallback(
    (value: string) => {
      const snapshot = current.current;
      if (snapshot.loaded) {
        edit(snapshot.loaded.id);
        drafts.current.set(snapshot.loaded.id, value);
      }
      snapshot.body = value;
      updateBody(value);
    },
    [edit],
  );
  const clear = useCallback(() => {
    const snapshot = current.current;
    if (snapshot.loaded && snapshot.loaded.body !== snapshot.body)
      drafts.current.set(snapshot.loaded.id, snapshot.body);
    resetAll();
    epoch.current++;
    snapshot.loaded = null;
    snapshot.body = "";
    setLoaded(null);
    updateBody("");
    setMessage("");
    onLock();
  }, [onLock, resetAll]);
  const persist = useCallback(
    (id: string, value: string): Promise<void> => {
      if (!alive.current) return Promise.resolve();
      const request = epoch.current;
      const at = version(id);
      if (!drafts.current.has(id)) drafts.current.set(id, value);
      // Serializa por nota para que una respuesta lenta no invierta los guardados.
      const operation = (writes.current.get(id) ?? Promise.resolve())
        .catch(() => undefined)
        .then(async () => {
          if (!alive.current) return;
          mark(id, at, "saving");
          try {
            const updated = await client.backend.invoke<Note>("update", { id, body_md: value });
            if (!alive.current) return;
            if (version(id) === at && drafts.current.get(id) === value) drafts.current.delete(id);
            mark(id, at, "saved");
            if (request === epoch.current && current.current.loaded?.id === id) {
              current.current.loaded = { id, body: updated.body_md };
              setLoaded(current.current.loaded);
              setMessage("");
            }
          } catch (reason) {
            if (alive.current && errorCode(reason) !== "E_PERMISSION_DENIED") mark(id, at, "error");
            if (alive.current && request === epoch.current && current.current.loaded?.id === id) {
              if (errorCode(reason) === "E_PERMISSION_DENIED") clear();
            }
            throw reason;
          }
        });
      writes.current.set(id, operation);
      void operation
        .finally(() => {
          if (writes.current.get(id) === operation) writes.current.delete(id);
        })
        .catch(() => undefined);
      return operation;
    },
    [client, clear, mark, version],
  );
  const settle = useCallback(
    (id: string) => (writes.current.get(id) ?? Promise.resolve()).catch(() => undefined),
    [],
  );
  const save = useCallback(
    (id: string, value: string, retry = false) => {
      const snapshot = current.current;
      if (
        snapshot.note?.id !== id ||
        snapshot.loaded?.id !== id ||
        (!retry && phase(id) === "error")
      )
        return;
      if (!retry && snapshot.loaded.body === value && !writes.current.has(id)) {
        if (phase(id) === "pending") mark(id, version(id), "idle");
        return;
      }
      void persist(id, value).catch(() => undefined);
    },
    [persist, phase, mark, version],
  );
  const id = note?.id;
  const privateNote = note?.private && !note.orphaned;
  useEffect(() => {
    const request = ++epoch.current;
    if (current.current.loaded?.id !== id || !privateNote || !unlocked) {
      setLoaded(null);
      updateBody("");
    }
    setMessage("");
    if (!privateNote || !unlocked || !id) return;
    void client.backend
      .invoke<Note>("get", { id })
      .then((value) => {
        if (request !== epoch.current) return;
        const draft = drafts.current.get(id);
        setLoaded({ id, body: value.body_md });
        updateBody(draft ?? value.body_md);
        if (draft !== undefined && draft !== value.body_md && phase(id) === "idle") edit(id);
        if (draft !== undefined && draft !== value.body_md) setMessage(t("vault.draftRestored"));
      })
      .catch(() => {
        if (request === epoch.current) clear();
      });
    return () => {
      epoch.current++;
    };
  }, [client, id, privateNote, unlocked, clear, t, edit, phase]);
  const discard = () => {
    clear();
    drafts.current.clear();
  };
  return {
    body,
    setBody,
    loaded,
    clear,
    discard,
    save,
    persist,
    settle,
    current,
    epoch,
    message,
    savePhase: id ? (states[id] ?? "idle") : "idle",
    retrySave: () => {
      const snapshot = current.current;
      if (snapshot.loaded && snapshot.note?.id === snapshot.loaded.id)
        save(snapshot.loaded.id, snapshot.body, true);
    },
  };
}
