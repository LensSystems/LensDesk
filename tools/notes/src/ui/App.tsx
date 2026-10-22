import type { createToolClient } from "@lensdesk/sdk";
import { ConfirmDialog, Notice, TooltipProvider, UiLabelsProvider } from "@lensdesk/ui";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Editor } from "./Editor.tsx";
import { EmptyNote } from "./EmptyNote.tsx";
import { NotesSidebar } from "./NotesSidebar.tsx";
import { TrashView } from "./TrashView.tsx";
import { UnlockPanel } from "./UnlockPanel.tsx";
import { useAutosave } from "./use-autosave.ts";
import { useNotes } from "./use-notes.ts";
import { useVault } from "./use-vault.ts";
import { VaultPanels } from "./VaultPanels.tsx";

type Client = ReturnType<typeof createToolClient>;

export function App({ client }: { client: Client }) {
  const { t } = useTranslation();
  const state = useNotes(client);
  const vault = useVault(client, state.selected, state.load, state.body);
  // Para notas privadas: vale mientras no se bloquee la bóveda ni se cambie de nota.
  const stillUnlocked = () => {
    if (!state.selected?.private) return () => true;
    const at = vault.epoch.current;
    return () => vault.epoch.current === at;
  };
  const privateNote = Boolean(state.selected?.private);
  const body = privateNote ? vault.body : state.body;
  useEffect(() => {
    document.title = t("title");
  }, [t]);
  const [preview, setPreview] = useState(false);
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  const flush = useAutosave(
    vault.ready && !vault.readOnly ? (state.selected?.id ?? null) : null,
    body,
    privateNote ? vault.save : state.save,
  );
  useEffect(
    () =>
      client.app.onVisibilityChange((visible) => {
        if (!visible) {
          flush();
          setPreview(true);
        }
      }),
    [client, flush],
  );
  const create = () => {
    flush();
    void state.create().then((created) => {
      if (created) setPreview(false);
    });
  };
  const updateBody = useCallback(
    (value: string) => (privateNote ? vault.setBody(value) : state.setBody(value)),
    [privateNote, vault.setBody, state.setBody],
  );

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
          {vault.message && vault.ready && <Notice tone="warning" title={vault.message} />}
          {state.loading ? (
            <p>{t("loading")}</p>
          ) : (
            <div className="workspace">
              <NotesSidebar
                notes={state.notes}
                selectedId={state.selectedId}
                query={state.query}
                trashed={state.trashed}
                archived={state.notesView === "archived"}
                onQuery={state.setQuery}
                onSelect={(id) => {
                  flush();
                  if (id !== state.selectedId) setPreview(true);
                  state.selectNote(id);
                }}
                onImport={() => {
                  flush();
                  void state.importNotes();
                }}
                onEmpty={() => setConfirmingEmpty(true)}
                onView={(view) => {
                  flush();
                  setPreview(true);
                  state.setView(view);
                }}
                onCreate={create}
                onArchive={(note) => {
                  flush();
                  setPreview(true);
                  void state.archive(note);
                }}
                onTrash={(id) => {
                  flush();
                  void state.trashNote(id);
                }}
                onPin={(note) =>
                  void client.backend
                    .invoke("setPinned", { id: note.id, pinned: !note.pinned })
                    .then(() => state.load(state.notesView, state.query))
                    .catch((reason: unknown) => state.fail(reason))
                }
              />
              {state.selected ? (
                state.trashed && vault.ready ? (
                  <TrashView
                    onCopyCode={(code) => client.ui.copyText(code)}
                    note={{ ...state.selected, body_md: body }}
                    onRestore={() => void state.restore(state.selected?.id ?? "")}
                  />
                ) : (
                  <Editor
                    key={`${state.selected.id}:${vault.ready}`}
                    preview={preview}
                    onMode={setPreview}
                    onCopy={() =>
                      vault.ready ? state.copyNote(body, stillUnlocked()) : Promise.resolve(false)
                    }
                    locked={!vault.ready}
                    readOnly={vault.readOnly}
                    onPrivate={() => void vault.toggle()}
                    onCopyCode={(code) => client.ui.copyText(code)}
                    note={{ ...state.selected, body_md: body }}
                    onChange={updateBody}
                    onBlur={flush}
                    onRename={(title) => state.rename(state.selected?.id ?? "", title)}
                    onExport={() => {
                      if (vault.ready) void state.exportNote(body, stillUnlocked());
                    }}
                  >
                    {vault.status.unlocked ? (
                      <p role="status">{t("loading")}</p>
                    ) : (
                      <UnlockPanel
                        error={vault.error}
                        busy={vault.busy}
                        onSubmit={(password) => void vault.unlock(password)}
                        onForgot={() => vault.setDialog("reset")}
                      />
                    )}
                  </Editor>
                )
              ) : (
                <EmptyNote
                  query={state.query}
                  trashed={state.trashed}
                  archived={state.notesView === "archived"}
                  onCreate={create}
                />
              )}
            </div>
          )}
          <VaultPanels vault={vault} />
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
