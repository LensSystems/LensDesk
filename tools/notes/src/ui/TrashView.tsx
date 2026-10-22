import { Button, RotateCcw } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { Note } from "./NoteList.tsx";
import { NotePreview } from "./NotePreview.tsx";

export function TrashView({
  note,
  onRestore,
  onCopyCode,
}: {
  note: Note;
  onRestore: () => void;
  onCopyCode: (code: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <section className="editor-panel">
      <header className="editor-toolbar">
        <h2>{note.title || t("untitled")}</h2>
        <Button variant="primary" onClick={onRestore}>
          <RotateCcw size={14} aria-hidden="true" />
          {t("restore")}
        </Button>
      </header>
      <NotePreview body={note.body_md} onCopyCode={onCopyCode} />
    </section>
  );
}
