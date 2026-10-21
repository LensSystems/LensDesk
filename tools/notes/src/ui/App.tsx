import type { createToolClient } from "@lensdesk/sdk";
import { ConfirmDialog, Notice, TooltipProvider, UiLabelsProvider } from "@lensdesk/ui";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Editor } from "./Editor.tsx";
import { EmptyNote } from "./EmptyNote.tsx";
import { NotesSidebar } from "./NotesSidebar.tsx";
import { TrashView } from "./TrashView.tsx";
import { useAutosave } from "./use-autosave.ts";
import { useNotes } from "./use-notes.ts";

type Client = ReturnType<typeof createToolClient>;

export function App({ client }: { client: Client }) {
  const { t } = useTranslation();
  const state = useNotes(client);
  useEffect(() => {
    document.title = t("title");
  }, [t]);
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  const flush = useAutosave(state.selected?.id ?? null, state.body, state.save);
  const updateBody = useCallback((value: string) => state.setBody(value), [state.setBody]);

  return (
    <UiLabelsProvider labels={{ loading: t("loading"), close: t("close"), dismiss: t("close") }}>
      <TooltipProvider>
        <main className="notes-app">
          {state.error && (
            <Notice
              tone={state.errorKind === "error" ? "danger" : "warning"}
              title={state.error}
              action={
                state.errorKind === "error"
                  ? { label: t("retry"), onClick: () => void state.load() }
                  : { label: t("close"), onClick: () => state.setError("") }
              }
            />
          )}
          {state.loading ? (
            <p>{t("loading")}</p>
          ) : (
            <div className="workspace">
              <NotesSidebar
                notes={state.notes}
                selectedId={state.selectedId}
                query={state.query}
                trashed={state.trashed}
                onQuery={state.setQuery}
                onSelect={(id) => {
                  flush();
                  state.selectNote(id);
                }}
                onImport={() => {
                  flush();
                  void state.importNotes();
                }}
                onEmpty={() => setConfirmingEmpty(true)}
                onView={(trash) => {
                  flush();
                  state.setTrashed(trash);
                }}
                onCreate={() => {
                  flush();
                  void state.create();
                }}
                onTrash={(id) => void state.trashNote(id)}
                onPin={(note) =>
                  void client.backend
                    .invoke("setPinned", { id: note.id, pinned: !note.pinned })
                    .then(() => state.load(false, state.query))
                    .catch((reason: unknown) => state.fail(reason))
                }
              />
              {state.selected ? (
                state.trashed ? (
                  <TrashView
                    note={state.selected}
                    onRestore={() => void state.restore(state.selected?.id ?? "")}
                  />
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
                <EmptyNote
                  query={state.query}
                  trashed={state.trashed}
                  onCreate={() => {
                    flush();
                    void state.create();
                  }}
                />
              )}
            </div>
          )}
          <ConfirmDialog
            open={confirmingEmpty}
            title={t("confirmEmptyTitle")}
            description={t("confirmEmptyMessage")}
            tone="danger"
            confirmLabel={t("emptyTrash")}
            cancelLabel={t("cancel")}
            onConfirm={() => {
              setConfirmingEmpty(false);
              void state.emptyTrash();
            }}
            onOpenChange={setConfirmingEmpty}
          />
        </main>
      </TooltipProvider>
    </UiLabelsProvider>
  );
}
