import { Button, ConfirmDialog, RotateCcw } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { editorHeaderBase, editorHeaderResponsive } from "./editor-header-classes.ts";
import type { Note } from "./NoteList.tsx";
import { NotePreview } from "./NotePreview.tsx";
import { OrphanedNote } from "./OrphanedNote.tsx";

export function TrashView({
  note,
  onRestore,
  onDelete,
  onCopyCode,
}: {
  note: Note;
  onRestore: () => void;
  onDelete?: () => Promise<void>;
  onCopyCode: (code: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <section className="editor-panel">
      <header className={`${editorHeaderBase} ${editorHeaderResponsive}`}>
        <h2 className="min-w-0 flex-1 truncate text-[18px] leading-7 font-bold text-text">
          {note.title || t("untitled")}
        </h2>
        {note.orphaned ? (
          <Button
            className="shrink-0 border-danger bg-transparent text-danger"
            onClick={() => setConfirming(true)}
          >
            {t("vault.deleteForever")}
          </Button>
        ) : (
          <Button className="shrink-0" variant="primary" onClick={onRestore}>
            <RotateCcw size={14} aria-hidden="true" />
            {t("restore")}
          </Button>
        )}
      </header>
      {note.orphaned ? (
        <OrphanedNote />
      ) : (
        <NotePreview body={note.body_md} onCopyCode={onCopyCode} />
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        title={t("vault.deleteTitle")}
        description={t("vault.deleteHelp")}
        cancelLabel={t("cancel")}
        confirmLabel={t("vault.delete")}
        busy={busy}
        onConfirm={() => {
          setBusy(true);
          void onDelete?.()
            .then(() => setConfirming(false))
            .finally(() => setBusy(false));
        }}
      />
    </section>
  );
}
