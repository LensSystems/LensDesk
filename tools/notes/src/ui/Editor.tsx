import { markdown } from "@codemirror/lang-markdown";
import { highlightActiveLine, highlightActiveLineGutter, lineNumbers } from "@codemirror/view";
import { Button, Download, MarkdownView, SegmentedControl } from "@lensdesk/ui";
import { EditorView } from "codemirror";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { markdownHighlighting } from "./markdown-highlight.ts";
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
  const editorLabel = useRef(t("edit"));
  const initialBody = useRef(note.body_md);
  const view = useRef<EditorView | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const instance = new EditorView({
      doc: initialBody.current,
      extensions: [
        EditorView.lineWrapping,
        EditorView.contentAttributes.of(() => ({ "aria-label": editorLabel.current })),
        markdown(),
        markdownHighlighting,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
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
    editorLabel.current = t("edit");
    view.current?.dispatch({});
  }, [t]);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== note.body_md)
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: note.body_md } });
  }, [note.body_md]);

  return (
    <section className="editor-panel">
      <header className="editor-toolbar">
        <h2>{note.title || t("untitled")}</h2>
        <SegmentedControl
          aria-label={t("mode")}
          value={preview ? "preview" : "edit"}
          onValueChange={(value) => {
            onBlur();
            setPreview(value === "preview");
          }}
          options={[
            { value: "edit", label: t("edit") },
            { value: "preview", label: t("preview") },
          ]}
        />
        <Button type="button" onClick={onExport}>
          <Download size={14} aria-hidden="true" />
          {t("export")}
        </Button>
      </header>
      <div className="code-editor" ref={host} hidden={preview} />
      {preview && (
        <MarkdownView
          className="min-h-0 flex-1 overflow-auto p-6"
          html={renderPreview(note.body_md)}
        />
      )}
    </section>
  );
}
