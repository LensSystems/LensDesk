import type { createToolClient } from "@lensdesk/sdk";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Editor } from "./Editor.tsx";
import { NoteList } from "./NoteList.tsx";
import { useAutosave } from "./use-autosave.ts";
import { useNotes } from "./use-notes.ts";

type Client = ReturnType<typeof createToolClient>;

export function App({ client }: { client: Client }) {
  const { t } = useTranslation();
  const state = useNotes(client);
  const flush = useAutosave(state.selected?.id ?? null, state.body, state.save);
  const updateBody = useCallback((value: string) => state.setBody(value), [state.setBody]);

  return (
    <main className="notes-app">
      <header className="app-toolbar">
        <h1>{t("title")}</h1>
        <button type="button" aria-pressed={!state.trashed} onClick={() => state.setTrashed(false)}>
          {t("notes")}
        </button>
        <button type="button" aria-pressed={state.trashed} onClick={() => state.setTrashed(true)}>
          {t("trash")}
        </button>
        <button type="button" onClick={state.importNotes}>
          {t("import")}
        </button>
        {state.trashed && (
          <button type="button" onClick={state.emptyTrash}>
            {t("emptyTrash")}
          </button>
        )}
      </header>
      {state.error && (
        <div role="alert">
          <span>{state.error}</span>
          <button type="button" onClick={() => void state.load()}>
            {t("retry")}
          </button>
        </div>
      )}
      {state.loading ? (
        <p>{t("loading")}</p>
      ) : (
        <div className="workspace">
          <NoteList
            notes={state.notes}
            selectedId={state.selectedId}
            query={state.query}
            trashed={state.trashed}
            onQuery={state.setQuery}
            onSelect={(id) => {
              state.setSelectedId(id);
              state.setBody(state.notes.find((note) => note.id === id)?.body_md ?? "");
            }}
            onCreate={() => void state.create()}
            onTrash={(id) => void state.trashNote(id)}
            onPin={(note) =>
              void client.backend
                .invoke("setPinned", { id: note.id, pinned: !note.pinned })
                .then(() => state.load(false, state.query))
                .catch((reason: unknown) =>
                  state.setError(t("errors.generic", { code: errorCode(reason) })),
                )
            }
          />
          {state.selected ? (
            state.trashed ? (
              <button type="button" onClick={() => void state.restore(state.selected?.id ?? "")}>
                {t("restore")}
              </button>
            ) : (
              <Editor
                key={state.selected.id}
                note={{ ...state.selected, body_md: state.body }}
                onChange={updateBody}
                onBlur={flush}
                onExport={() => void state.exportNote()}
              />
            )
          ) : (
            <div className="empty-state">
              <p>{t("emptyNotes")}</p>
              {!state.trashed && (
                <button type="button" onClick={() => void state.create()}>
                  {t("newNote")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "E_INTERNAL";
}
