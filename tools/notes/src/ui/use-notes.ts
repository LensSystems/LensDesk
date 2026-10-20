import type { createToolClient } from "@lensdesk/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Note } from "./NoteList.tsx";
import { useAppContext } from "./use-app-context.ts";
import { errorCode, useFail, useNotice } from "./use-failure.ts";

type Client = ReturnType<typeof createToolClient>;

export function useNotes(client: Client) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const drafts = useRef(new Map<string, string>());
  const editBody = useCallback((value: string) => {
    if (selectedRef.current) drafts.current.set(selectedRef.current, value);
    setBody(value);
  }, []);
  const [query, setQuery] = useState("");
  const [trashed, setTrashed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { error, errorKind, setError } = useNotice();
  const selected = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  );

  // La selección se lee desde una referencia para que elegir una nota no vuelva a cargar la lista.
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  // Último estado conocido de las notas: el autoguardado solo escribe si el cuerpo difiere.
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Solo la primera carga muestra "Cargando": las siguientes conservan la lista, el cuadro de
  // búsqueda con su foco y el texto que el editor aún no ha guardado.
  const load = useCallback(
    async (inTrash = trashed, search = query): Promise<boolean> => {
      try {
        const rows =
          search.trim() && !inTrash
            ? await client.backend.invoke<Note[]>("search", { query: search })
            : await client.backend.invoke<Note[]>("list", { trashed: inTrash });
        setNotes(rows);
        if (!rows.some((note) => note.id === selectedRef.current)) {
          setSelectedId(rows[0]?.id ?? null);
          setBody(rows[0]?.body_md ?? "");
        }
        setError("");
        return true;
      } catch (reason) {
        setError(t("errors.generic", { code: errorCode(reason) }));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [client, query, setError, t, trashed],
  );

  useAppContext(client);

  useEffect(() => {
    void load(trashed, query);
  }, [trashed, query, load]);

  const fail = useFail(load, setError);

  // Si la nota desapareció mientras se editaba, el texto se conserva como nota nueva.
  const recover = useCallback(
    async (id: string, value: string) => {
      const note = await client.backend.invoke<Note>("create", { body_md: value });
      setNotes((current) => [note, ...current.filter((item) => item.id !== id)]);
      setSelectedId(note.id);
      setBody(note.body_md);
      setError(t("errors.notFoundRecovered"), "recovered");
    },
    [client, setError, t],
  );

  // Guardados en curso por nota: el mismo contenido no se envía dos veces a la vez.
  const pending = useRef(new Map<string, string>());
  const save = useCallback(
    (id: string, value: string) => {
      const known = notesRef.current.find((note) => note.id === id);
      if (known && known.body_md === value) return;
      if (pending.current.get(id) === value) return;
      pending.current.set(id, value);
      void client.backend
        .invoke<Note>("update", { id, body_md: value })
        .finally(() => {
          if (pending.current.get(id) === value) pending.current.delete(id);
        })
        .then((updated) => {
          if (drafts.current.get(id) === value) drafts.current.delete(id);
          setNotes((current) => current.map((note) => (note.id === id ? updated : note)));
          setError("");
        })
        .catch((reason: unknown) =>
          (errorCode(reason) === "E_NOT_FOUND" ? recover(id, value) : fail(reason)).catch(
            (next: unknown) => fail(next),
          ),
        );
    },
    [client, fail, recover, setError],
  );

  const create = async (content = "") => {
    try {
      const note = await client.backend.invoke<Note>("create", { body_md: content });
      setTrashed(false);
      setQuery("");
      setNotes((current) => [note, ...current]);
      setSelectedId(note.id);
      setBody(note.body_md);
      setError("");
    } catch (reason) {
      await fail(reason);
    }
  };

  const importNotes = async () => {
    try {
      const files = await client.files.pickOpen({
        multiple: true,
        filters: [{ name: t("markdownFiles"), extensions: ["md", "markdown"] }],
      });
      for (const file of files) await create(await client.files.readText(file.token));
    } catch (reason) {
      await fail(reason);
    }
  };

  const exportNote = async () => {
    if (!selected) return;
    try {
      const file = await client.files.pickSave({
        defaultName: `${selected.title || t("untitled")}.md`,
        filters: [{ name: t("markdownFiles"), extensions: ["md"] }],
      });
      if (file) await client.files.writeText(file.token, body);
    } catch (reason) {
      await fail(reason);
    }
  };

  const trashNote = async (id: string) => {
    try {
      await client.backend.invoke("trash", { id });
      await load(false, query);
    } catch (reason) {
      await fail(reason);
    }
  };
  const restore = async (id: string) => {
    try {
      await client.backend.invoke("restore", { id });
      await load(true, "");
    } catch (reason) {
      await fail(reason);
    }
  };
  const emptyTrash = async () => {
    try {
      await client.backend.invoke("emptyTrash", {});
      setSelectedId(null);
      setBody("");
      await load(true, "");
    } catch (reason) {
      await fail(reason);
    }
  };

  return {
    body,
    create,
    emptyTrash,
    fail,
    error,
    errorKind,
    exportNote,
    importNotes,
    load,
    loading,
    notes,
    query,
    restore,
    save,
    selected,
    selectedId,
    setBody: editBody,
    selectNote: (id: string) => {
      setSelectedId(id);
      setBody(drafts.current.get(id) ?? notes.find((note) => note.id === id)?.body_md ?? "");
    },
    setError,
    setQuery,
    setSelectedId,
    setTrashed,
    trashNote,
    trashed,
  };
}
