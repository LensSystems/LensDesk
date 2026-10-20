import { Button, MarkdownView, RotateCcw } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { Note } from "./NoteList.tsx";
import { renderPreview } from "./preview.ts";

export function TrashView({ note, onRestore }: { note: Note; onRestore: () => void }) {
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
      <MarkdownView
        className="min-h-0 flex-1 overflow-auto p-6"
        html={renderPreview(note.body_md)}
      />
    </section>
  );
}
