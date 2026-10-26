import type { createToolClient } from "@lensdesk/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ensureGuide } from "./guide.ts";
import type { Note, NotesView } from "./NoteList.tsx";
import { useAppContext } from "./use-app-context.ts";
import { errorCode, useFail, useNotice } from "./use-failure.ts";
import { useNoteActions } from "./use-note-actions.ts";
import { useNoteFiles } from "./use-note-files.ts";

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
  const [notesView, setView] = useState<NotesView>("notes");
  const trashed = notesView === "trash";
  const [loading, setLoading] = useState(true);
  const { error, errorKind, setError } = useNotice();
  const selected = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  );
  // Elegir una nota no debe volver a cargar la lista.
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const notesRef = useRef(notes);
  notesRef.current = notes;
  // Las respuestas antiguas no reemplazan una lista más reciente.
  const latestLoad = useRef(0);
  const view = useRef({ notesView, query });
  view.current = { notesView, query };
  const load = useCallback(
    async (currentView = notesView, search = query): Promise<boolean> => {
      const request = ++latestLoad.current;
      try {
        await ensureGuide(client).catch(() => undefined);
        const rows =
          search.trim() && currentView === "notes"
            ? await client.backend.invoke<Note[]>("search", { query: search })
            : await client.backend.invoke<Note[]>("list", { view: currentView });
        if (request !== latestLoad.current) return true;
        const previous = notesRef.current.find((item) => item.id === selectedRef.current);
        const next = rows.find((item) => item.id === selectedRef.current);
        // La lista nunca es una fuente de cuerpos privados ni de borradores descifrados.
        if (next?.private) {
          drafts.current.delete(next.id);
          setBody("");
        }
        if (previous?.private && next && !next.private) setBody(next.body_md);
        setNotes(rows);
        if (!rows.some((note) => note.id === selectedRef.current)) {
          setSelectedId(rows[0]?.id ?? null);
          setBody(rows[0]?.body_md ?? "");
        }
        setError("");
        return true;
      } catch (reason) {
        if (request !== latestLoad.current) return true;
        setError(t("errors.generic", { code: errorCode(reason) }));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [client, query, setError, t, notesView],
  );
  const context = useAppContext(client);
  useEffect(() => {
    void load(notesView, query);
  }, [notesView, query, load]);
  const fail = useFail(load, setError);
  const recover = useCallback(
    async (id: string, value: string) => {
      const note = await client.backend.invoke<Note>("create", {
        body_md: value,
        title: notesRef.current.find((note) => note.id === id)?.title ?? "",
      });
      setNotes((current) => [note, ...current.filter((item) => item.id !== id)]);
      setSelectedId(note.id);
      setBody(note.body_md);
      setError(t("errors.notFoundRecovered"), "recovered");
    },
    [client, setError, t],
  );
  const pending = useRef(new Map<string, string>());
  const save = useCallback(
    (id: string, value: string) => {
      const known = notesRef.current.find((note) => note.id === id);
      // Los cuerpos privados solo se guardan desde la bóveda, después de get.
      if (known?.private || (known && known.body_md === value)) return;
      if (pending.current.get(id) === value) return;
      pending.current.set(id, value);
      void client.backend
        .invoke<Note>("update", { id, body_md: value })
        .finally(() => {
          if (pending.current.get(id) === value) pending.current.delete(id);
        })
        .then((updated) => {
          if (drafts.current.get(id) === value) drafts.current.delete(id);
          setNotes((current) =>
            current.map((note) =>
              note.id === id
                ? { ...note, body_md: updated.body_md, updated_at: updated.updated_at }
                : note,
            ),
          );
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
  const create = async (content = "", title = "") => {
    try {
      const note = await client.backend.invoke<Note>("create", { body_md: content, title });
      latestLoad.current++;
      setView("notes");
      setQuery("");
      setNotes((current) => [note, ...current]);
      setSelectedId(note.id);
      setBody(note.body_md);
      setError("");
      return true;
    } catch (reason) {
      await fail(reason);
    }
  };
  const renaming = useRef(new Map<string, Promise<Note>>());
  const rename = async (id: string, title: string) => {
    const request = client.backend.invoke<Note>("rename", { id, title });
    renaming.current.set(id, request);
    try {
      const updated = await request;
      notesRef.current = notesRef.current.map((note) =>
        note.id === id ? { ...note, title: updated.title } : note,
      );
      setNotes((current) =>
        current.map((note) => (note.id === id ? { ...note, title: updated.title } : note)),
      );
    } catch (reason) {
      await fail(reason);
      throw reason;
    } finally {
      if (renaming.current.get(id) === request) renaming.current.delete(id);
    }
  };
  const files = useNoteFiles(client, selected, body, notesRef, renaming, create, fail);
  const actions = useNoteActions(client, load, view, fail, () => {
    setSelectedId(null);
    setBody("");
  });
  return {
    context,
    body,
    ...files,
    create,
    ...actions,
    fail,
    error,
    errorKind,
    load,
    loading,
    notes,
    query,
    rename,
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
    setView,
    notesView,
    trashed,
  };
}
