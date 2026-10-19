import { markdown } from "@codemirror/lang-markdown";
import { Button, MarkdownView } from "@lensdesk/ui";
import { EditorView } from "codemirror";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Note } from "./NoteList.tsx";
import { renderPreview } from "./preview.ts";

export function Editor({
  note,
  onChange,
  onBlur,
  onExport,
}: {
  note: Note;
  onChange: (value: string) => void;
  onBlur: () => void;
  onExport: () => void;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const initialBody = useRef(note.body_md);
  const view = useRef<EditorView | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const instance = new EditorView({
      doc: initialBody.current,
      extensions: [
        EditorView.lineWrapping,
        markdown(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
      ],
      parent: host.current,
    });
    view.current = instance;
    const blur = () => onBlur();
    instance.dom.addEventListener("focusout", blur);
    return () => {
      instance.dom.removeEventListener("focusout", blur);
      instance.destroy();
      view.current = null;
    };
  }, [onChange, onBlur]);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== note.body_md)
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: note.body_md } });
  }, [note.body_md]);

  return (
    <section className="editor-panel">
      <header className="editor-toolbar">
        <h1>{note.title || t("untitled")}</h1>
        <Button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>
          {preview ? t("edit") : t("preview")}
        </Button>
        <Button type="button" onClick={onExport}>
          {t("export")}
        </Button>
      </header>
      {preview ? (
        <MarkdownView className="flex-1 overflow-auto p-3" html={renderPreview(note.body_md)} />
      ) : (
        <div className="code-editor" ref={host} />
      )}
    </section>
  );
}
