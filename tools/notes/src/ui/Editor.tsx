import { history, historyKeymap, redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState } from "@codemirror/state";
import {
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { EditorView } from "codemirror";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { credentialMask } from "./credential-mask.ts";
import { EditorHeader } from "./EditorHeader.tsx";
import { EditorMenu } from "./EditorMenu.tsx";
import { EditorToolbar } from "./EditorToolbar.tsx";
import { formatCommand, formatKeymap } from "./editor-commands.ts";
import { markdownHighlighting } from "./markdown-highlight.ts";
import type { Note } from "./NoteList.tsx";
import { NotePreview } from "./NotePreview.tsx";
export function Editor({
  note,
  preview,
  onMode,
  onCopy,
  onCopyCode,
  onChange,
  onBlur,
  onExport,
  onRename,
  onPrivate,
  locked = false,
  readOnly = false,
  children,
}: {
  onPrivate?: () => void;
  locked?: boolean;
  readOnly?: boolean;
  children?: ReactNode;
  note: Note;
  preview: boolean;
  onMode: (preview: boolean) => void;
  onCopy: () => Promise<boolean>;
  onCopyCode: (code: string) => Promise<void>;
  onChange: (value: string) => void;
  onBlur: () => void;
  onExport: () => void;
  onRename: (title: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const editorLabel = useRef(t("edit"));
  const editable = useRef(new Compartment());
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const bodyRef = useRef(note.body_md);
  bodyRef.current = note.body_md;
  const view = useRef<EditorView | null>(null);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });

  useEffect(() => {
    if (locked || !host.current) return;
    const instance = new EditorView({
      doc: bodyRef.current,
      extensions: [
        editable.current.of([
          EditorState.readOnly.of(readOnlyRef.current),
          EditorView.editable.of(!readOnlyRef.current),
        ]),
        EditorView.lineWrapping,
        history(),
        keymap.of([
          ...formatKeymap,
          ...historyKeymap,
          { key: "Mod-Shift-z", run: redo },
          { key: "Ctrl-y", run: redo },
        ]),
        EditorView.contentAttributes.of(() => ({ "aria-label": editorLabel.current })),
        markdown(),
        credentialMask,
        markdownHighlighting,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        EditorView.updateListener.of((update) => {
          const next = { undo: undoDepth(update.state), redo: redoDepth(update.state) };
          setDepth((old) => (old.undo === next.undo && old.redo === next.redo ? old : next));
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
  }, [onChange, onBlur, locked]);
  useLayoutEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);
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
      <EditorHeader
        {...{ note, preview, locked, onPrivate, onMode, onBlur, onCopy, onExport, onRename }}
      />
      {locked ? (
        children
      ) : (
        <>
          <div
            className="relative min-h-0 flex-1 flex-col"
            style={{ display: preview ? "none" : "flex" }}
          >
            <EditorToolbar
              canUndo={!readOnly && depth.undo > 0}
              canRedo={!readOnly && depth.redo > 0}
              onUndo={() => {
                if (view.current && !view.current.state.readOnly) {
                  undo(view.current);
                  view.current.focus();
                }
              }}
              onRedo={() => {
                if (view.current && !view.current.state.readOnly) {
                  redo(view.current);
                  view.current.focus();
                }
              }}
              onFormat={(format) => {
                if (view.current && !view.current.state.readOnly) {
                  formatCommand(format)(view.current);
                  view.current.focus();
                }
              }}
            />
            <EditorMenu view={view} privateNote={!!note.private && !locked} readOnly={readOnly}>
              <div className="code-editor" ref={host} />
            </EditorMenu>
          </div>
          {preview && (
            <NotePreview privateNote={!!note.private} body={note.body_md} onCopyCode={onCopyCode} />
          )}
        </>
      )}
    </section>
  );
}
