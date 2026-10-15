import type { createToolClient } from "@lensdesk/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Note } from "./NoteList.tsx";

type Client = ReturnType<typeof createToolClient>;

export function useNotes(client: Client) {
  const { t, i18n } = useTranslation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [trashed, setTrashed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selected = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  );

  // La selección se lee desde una referencia para que elegir una nota no vuelva a cargar la lista.
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  // Solo la primera carga muestra "Cargando": las siguientes conservan la lista, el cuadro de
  // búsqueda con su foco y el texto que el editor aún no ha guardado.
  const load = useCallback(
    async (inTrash = trashed, search = query) => {
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
      } catch (reason) {
        setError(t("errors.generic", { code: errorCode(reason) }));
      } finally {
        setLoading(false);
      }
    },
    [client, query, t, trashed],
  );

  useEffect(() => {
    let alive = true;
    const applyContext = (context: { locale: string; theme: string }) => {
      document.documentElement.dataset.theme = context.theme;
      document.documentElement.lang = context.locale;
      void i18n.changeLanguage(context.locale);
    };
    void client.app
      .getContext()
      .then((context) => {
        if (alive) applyContext(context);
      })
      .catch(() => undefined);
    const unsubscribe = client.app.onContextChange(applyContext);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [client, i18n]);

  useEffect(() => {
    void load(trashed, query);
  }, [trashed, query, load]);

  const save = useCallback(
    (id: string, value: string) => {
      void client.backend
        .invoke<Note>("update", { id, body_md: value })
        .then((updated) => {
          setNotes((current) => current.map((note) => (note.id === id ? updated : note)));
          setError("");
        })
        .catch((reason: unknown) => setError(t("errors.generic", { code: errorCode(reason) })));
    },
    [client, t],
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
      setError(t("errors.generic", { code: errorCode(reason) }));
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
      setError(t("errors.generic", { code: errorCode(reason) }));
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
      setError(t("errors.generic", { code: errorCode(reason) }));
    }
  };

  const trashNote = async (id: string) => {
    try {
      await client.backend.invoke("trash", { id });
      await load(false, query);
    } catch (reason) {
      setError(t("errors.generic", { code: errorCode(reason) }));
    }
  };
  const restore = async (id: string) => {
    try {
      await client.backend.invoke("restore", { id });
      await load(true, "");
    } catch (reason) {
      setError(t("errors.generic", { code: errorCode(reason) }));
    }
  };
  const emptyTrash = async () => {
    if (!window.confirm(t("confirmEmptyTrash"))) return;
    try {
      await client.backend.invoke("emptyTrash");
      setSelectedId(null);
      setBody("");
      await load(true, "");
    } catch (reason) {
      setError(t("errors.generic", { code: errorCode(reason) }));
    }
  };

  return {
    body,
    create,
    emptyTrash,
    error,
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
    setBody,
    setError,
    setQuery,
    setSelectedId,
    setTrashed,
    trashNote,
    trashed,
  };
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "E_INTERNAL";
}
