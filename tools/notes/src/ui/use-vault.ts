import type { createToolClient } from "@lensdesk/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "./NoteList.tsx";
import { useVaultActions } from "./use-vault-actions.ts";
import { useVaultDocument } from "./use-vault-document.ts";

export type VaultStatus = { configured: boolean; unlocked: boolean; questions: string[] };
export function useVault(
  client: ReturnType<typeof createToolClient>,
  note: Note | null,
  reload: () => Promise<boolean>,
  publicBody = "",
) {
  const [status, setStatus] = useState<VaultStatus>({
    configured: false,
    unlocked: false,
    questions: [],
  });
  const visible = useRef(true);
  const locking = useRef<Promise<unknown>>(Promise.resolve());
  const blocked = useRef(false);
  const onLock = useCallback(() => {
    blocked.current = true;
    setStatus((old) => ({ ...old, unlocked: false }));
  }, []);
  const document = useVaultDocument(client, note, publicBody, status.unlocked, onLock);
  const { clear, current, persist } = document;
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const refresh = useCallback(
    async (allowUnlock = false) => {
      const pending = locking.current;
      await pending;
      const next = await client.backend.invoke<VaultStatus>("vaultStatus", {});
      if (!next || !visible.current || pending !== locking.current) return;
      if (allowUnlock) blocked.current = false;
      const effective = { ...next, unlocked: next.unlocked && !blocked.current };
      if (!effective.unlocked && current.current.loaded) clear();
      setStatus(effective);
      return effective;
    },
    [client, clear, current],
  );
  const actions = useVaultActions(client, document, visible, refresh, reload);
  const { setDialog } = actions;
  useEffect(() => {
    void refresh().catch(() => undefined);
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 1000);
    const unsubscribe = client.app.onVisibilityChange((isVisible) => {
      visible.current = isVisible;
      if (!isVisible) {
        setDialog(null);
        const snapshot = current.current;
        const saving =
          snapshot.loaded && snapshot.loaded.body !== snapshot.body
            ? persistRef.current(snapshot.loaded.id, snapshot.body)
            : Promise.resolve();
        clear();
        locking.current = saving
          .catch(() => undefined)
          .then(() => client.backend.invoke("vaultLock", {}))
          .catch(() => undefined);
      } else void refresh().catch(() => undefined);
    });
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [client, clear, current, refresh, setDialog]);
  return {
    ...actions,
    lock: async () => {
      const snapshot = current.current;
      const saving =
        snapshot.loaded && snapshot.loaded.body !== snapshot.body
          ? persistRef.current(snapshot.loaded.id, snapshot.body)
          : Promise.resolve();
      onLock();
      clear();
      locking.current = saving
        .catch(() => undefined)
        .then(() => client.backend.invoke("vaultLock", {}))
        .catch(() => undefined);
      await locking.current;
    },
    body: document.body,
    setBody: document.setBody,
    save: document.save,
    ready: !note?.private || (status.unlocked && document.loaded?.id === note.id),
    status,
    message: document.message,
    // Cambia al bloquear, ocultar o cambiar de nota: invalida copias y exportaciones en curso.
    epoch: document.epoch,
  };
}
