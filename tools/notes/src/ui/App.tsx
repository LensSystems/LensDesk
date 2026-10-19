import type { createToolClient } from "@lensdesk/sdk";
import {
  Button,
  ConfirmDialog,
  Notice,
  SegmentedControl,
  TooltipProvider,
  UiLabelsProvider,
} from "@lensdesk/ui";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Editor } from "./Editor.tsx";
import { NoteList } from "./NoteList.tsx";
import { useAutosave } from "./use-autosave.ts";
import { useNotes } from "./use-notes.ts";

type Client = ReturnType<typeof createToolClient>;

export function App({ client }: { client: Client }) {
  const { t } = useTranslation();
  const state = useNotes(client);
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  const flush = useAutosave(state.selected?.id ?? null, state.body, state.save);
  const updateBody = useCallback((value: string) => state.setBody(value), [state.setBody]);

  return (
    <UiLabelsProvider labels={{ loading: t("loading"), close: t("close"), dismiss: t("close") }}>
      <TooltipProvider>
        <main className="notes-app">
          <header className="app-toolbar">
            <h1>{t("title")}</h1>
            <SegmentedControl
              aria-label={t("notesView")}
              value={state.trashed ? "trash" : "notes"}
              onValueChange={(value) => state.setTrashed(value === "trash")}
              options={[
                { value: "notes", label: t("notes") },
                { value: "trash", label: t("trash") },
              ]}
            />
            <Button type="button" onClick={state.importNotes}>
              {t("import")}
            </Button>
            {state.trashed && (
              <Button type="button" onClick={() => setConfirmingEmpty(true)}>
                {t("emptyTrash")}
              </Button>
            )}
          </header>
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
                    .catch((reason: unknown) => state.fail(reason))
                }
              />
              {state.selected ? (
                state.trashed ? (
                  <div className="empty-state">
                    <Button
                      type="button"
                      onClick={() => void state.restore(state.selected?.id ?? "")}
                    >
                      {t("restore")}
                    </Button>
                  </div>
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
                    <Button type="button" onClick={() => void state.create()}>
                      {t("newNote")}
                    </Button>
                  )}
                </div>
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
