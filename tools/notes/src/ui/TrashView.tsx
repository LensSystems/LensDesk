import { Button, RotateCcw } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { editorHeaderBase, editorHeaderResponsive } from "./editor-header-classes.ts";
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
      <header className={`${editorHeaderBase} ${editorHeaderResponsive}`}>
        <h2 className="min-w-0 flex-1 truncate text-[18px] leading-7 font-bold text-text">
          {note.title || t("untitled")}
        </h2>
        <Button className="shrink-0" variant="primary" onClick={onRestore}>
          <RotateCcw size={14} aria-hidden="true" />
          {t("restore")}
        </Button>
      </header>
      <NotePreview body={note.body_md} onCopyCode={onCopyCode} />
    </section>
  );
}
