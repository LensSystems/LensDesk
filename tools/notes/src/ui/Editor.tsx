import { markdown } from "@codemirror/lang-markdown";
import { highlightActiveLine, highlightActiveLineGutter, lineNumbers } from "@codemirror/view";
import { Button, Copy, Eye, MarkdownView, Pencil, SegmentedControl, Upload } from "@lensdesk/ui";
import { EditorView } from "codemirror";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { markdownHighlighting } from "./markdown-highlight.ts";
import type { Note } from "./NoteList.tsx";
import { NoteTitle } from "./NoteTitle.tsx";
import { renderPreview } from "./preview.ts";

export function Editor({
  note,
  preview,
  onMode,
  onCopy,
  onChange,
  onBlur,
  onExport,
  onRename,
}: {
  note: Note;
  preview: boolean;
  onMode: (preview: boolean) => void;
  onCopy: () => Promise<boolean>;
  onChange: (value: string) => void;
  onBlur: () => void;
  onExport: () => void;
  onRename: (title: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const editorLabel = useRef(t("edit"));
  const initialBody = useRef(note.body_md);
  const view = useRef<EditorView | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

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
        <NoteTitle title={note.title} onRename={onRename} />
        <SegmentedControl
          aria-label={t("mode")}
          className="h-6 items-center p-0 [&>button]:h-6 [&>button]:px-2"
          value={preview ? "preview" : "edit"}
          onValueChange={(value) => {
            onBlur();
            onMode(value === "preview");
          }}
          options={[
            {
              value: "edit",
              label: (
                <span className="flex items-center gap-1">
                  <Pencil size={12} aria-hidden="true" />
                  {t("edit")}
                </span>
              ),
            },
            {
              value: "preview",
              label: (
                <span className="flex items-center gap-1">
                  <Eye size={12} aria-hidden="true" />
                  {t("preview")}
                </span>
              ),
            },
          ]}
        />
        <Button
          type="button"
          onClick={async () => {
            if (!(await onCopy())) return;
            setCopied(true);
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Copy size={14} aria-hidden="true" />
          {t(copied ? "copied" : "copyNote")}
        </Button>
        <Button type="button" onClick={onExport}>
          <Upload size={14} aria-hidden="true" />
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
