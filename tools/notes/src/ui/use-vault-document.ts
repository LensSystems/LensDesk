import type { createToolClient } from "@lensdesk/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Note } from "./NoteList.tsx";
import { errorCode } from "./use-failure.ts";

type Client = ReturnType<typeof createToolClient>;
export function useVaultDocument(
  client: Client,
  note: Note | null,
  publicBody: string,
  unlocked: boolean,
  onLock: () => void,
) {
  const { t } = useTranslation();
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
  const setBody = useCallback((value: string) => {
    const snapshot = current.current;
    if (snapshot.loaded) drafts.current.set(snapshot.loaded.id, value);
    snapshot.body = value;
    updateBody(value);
  }, []);
  const clear = useCallback(() => {
    const snapshot = current.current;
    if (snapshot.loaded && snapshot.loaded.body !== snapshot.body)
      drafts.current.set(snapshot.loaded.id, snapshot.body);
    epoch.current++;
    snapshot.loaded = null;
    snapshot.body = "";
    setLoaded(null);
    updateBody("");
    setMessage("");
    onLock();
  }, [onLock]);
  const persist = useCallback(
    (id: string, value: string): Promise<void> => {
      if (!alive.current) return Promise.resolve();
      const request = epoch.current;
      if (!drafts.current.has(id)) drafts.current.set(id, value);
      // Serializa por nota para que una respuesta lenta no invierta los guardados.
      const operation = (writes.current.get(id) ?? Promise.resolve())
        .catch(() => undefined)
        .then(async () => {
          if (!alive.current) return;
          try {
            const updated = await client.backend.invoke<Note>("update", { id, body_md: value });
            if (!alive.current) return;
            if (drafts.current.get(id) === value) drafts.current.delete(id);
            if (request === epoch.current && current.current.loaded?.id === id) {
              current.current.loaded = { id, body: updated.body_md };
              setLoaded(current.current.loaded);
            }
          } catch (reason) {
            if (alive.current && request === epoch.current && current.current.loaded?.id === id) {
              if (errorCode(reason) === "E_PERMISSION_DENIED") clear();
              else setMessage(t("vault.saveFailed"));
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
    [client, clear, t],
  );
  const settle = useCallback(
    (id: string) => (writes.current.get(id) ?? Promise.resolve()).catch(() => undefined),
    [],
  );
  const save = useCallback(
    (id: string, value: string) => {
      const snapshot = current.current;
      if (snapshot.note?.id !== id || snapshot.loaded?.id !== id || snapshot.loaded.body === value)
        return;
      void persist(id, value).catch(() => undefined);
    },
    [persist],
  );
  const id = note?.id;
  const privateNote = note?.private;
  useEffect(() => {
    const request = ++epoch.current;
    setLoaded(null);
    updateBody("");
    setMessage("");
    if (!privateNote || !unlocked || !id) return;
    void client.backend
      .invoke<Note>("get", { id })
      .then((value) => {
        if (request !== epoch.current) return;
        const draft = drafts.current.get(id);
        setLoaded({ id, body: value.body_md });
        updateBody(draft ?? value.body_md);
        if (draft !== undefined && draft !== value.body_md) setMessage(t("vault.draftRestored"));
      })
      .catch(() => {
        if (request === epoch.current) clear();
      });
    return () => {
      epoch.current++;
    };
  }, [client, id, privateNote, unlocked, clear, t]);
  return { body, setBody, loaded, clear, save, persist, settle, current, epoch, message };
}
