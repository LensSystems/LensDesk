import type { EditorView } from "@codemirror/view";
import { ContextMenu } from "@lensdesk/ui";
import { type ReactNode, type RefObject, useState } from "react";
import { useTranslation } from "react-i18next";
import { CredentialDialog } from "./CredentialDialog.tsx";
import { emptyCredential, formatCredential, parseCredential } from "./credential-block.ts";
import { credentialFences, credentialInsertion } from "./credential-fences.ts";
import { applyMarkdownEdit } from "./editor-commands.ts";
import { insertKinds, insertMarkdown } from "./markdown-insert.ts";

export function EditorMenu({
  children,
  view,
  privateNote = false,
  readOnly = false,
}: {
  children: ReactNode;
  privateNote?: boolean;
  readOnly?: boolean;
  view: RefObject<EditorView | null>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<{ from: number; to: number; content: string } | null>(
    null,
  );
  return (
    <>
      <ContextMenu
        label={t("insert.title")}
        onClose={() => view.current?.focus()}
        keyboardAnchor={() => {
          const editor = view.current;
          const coords = editor?.coordsAtPos(editor.state.selection.main.head);
          return coords ? { x: coords.left, y: coords.bottom } : null;
        }}
        items={[
          ...insertKinds.map((kind) => ({
            label: t(`insert.${kind}`),
            onSelect: () => {
              const editor = view.current;
              if (!editor) return;
              applyMarkdownEdit(
                editor,
                insertMarkdown(editor.state.doc.toString(), editor.state.selection.main, kind),
              );
            },
          })),
          {
            label: t("insert.password"),
            disabled: !privateNote || readOnly,
            onSelect: () => {
              const editor = view.current;
              if (!editor || editor.state.readOnly || !privateNote) return;
              const source = editor.state.doc.toString();
              const selection = editor.state.selection.main;
              setEditing(
                credentialFences(source).find(
                  (block) => selection.head >= block.from && selection.head <= block.to,
                ) ?? { from: selection.from, to: selection.to, content: "" },
              );
            },
          },
        ]}
      >
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </ContextMenu>
      {editing && privateNote && !readOnly && (
        <CredentialDialog
          initial={editing.content ? parseCredential(editing.content) : emptyCredential()}
          onClose={() => {
            setEditing(null);
            view.current?.focus();
          }}
          onSave={(value) => {
            const editor = view.current;
            if (editor && !editor.state.readOnly) {
              const change = editing.content
                ? { from: editing.from, to: editing.to, insert: `\n${formatCredential(value)}\n` }
                : credentialInsertion(
                    editor.state.doc.toString(),
                    editing.from,
                    editing.to,
                    formatCredential(value),
                  );
              // Sin posición segura no se inserta: el secreto quedaría visible.
              if (change) editor.dispatch({ changes: change });
            }
            setEditing(null);
            editor?.focus();
          }}
        />
      )}
    </>
  );
}
