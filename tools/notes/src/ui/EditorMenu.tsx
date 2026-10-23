import type { EditorView } from "@codemirror/view";
import type { createToolClient } from "@lensdesk/sdk";
import { ContextMenu } from "@lensdesk/ui";
import { type ReactNode, type RefObject, useState } from "react";
import { useTranslation } from "react-i18next";
import { CredentialDialog } from "./CredentialDialog.tsx";
import { emptyCredential, formatCredential, parseCredential } from "./credential-block.ts";
import { credentialFences, credentialInsertion } from "./credential-fences.ts";
import { editorMenuItems } from "./editor-menu-items.tsx";
import { useSpellingMenu } from "./use-spelling-menu.ts";

export function EditorMenu({
  client,
  spellcheck = false,
  children,
  view,
  privateNote = false,
  readOnly = false,
}: {
  client?: ReturnType<typeof createToolClient>;
  spellcheck?: boolean;
  children: ReactNode;
  privateNote?: boolean;
  readOnly?: boolean;
  view: RefObject<EditorView | null>;
}) {
  const { t } = useTranslation();
  const spellingMenu = useSpellingMenu(client, spellcheck, view, readOnly);
  const [editing, setEditing] = useState<{ from: number; to: number; content: string } | null>(
    null,
  );
  return (
    <>
      <ContextMenu
        {...spellingMenu}
        label={t("editorMenu")}
        showLabel={false}
        keyboardAnchor={() => {
          const editor = view.current;
          const coords = editor?.coordsAtPos(editor.state.selection.main.head);
          return coords ? { x: coords.left, y: coords.bottom } : null;
        }}
        items={() =>
          editorMenuItems(t, view.current, readOnly, privateNote, () => {
            const editor = view.current;
            if (!editor || editor.state.readOnly || !privateNote) return;
            const source = editor.state.doc.toString();
            const selection = editor.state.selection.main;
            setEditing(
              credentialFences(source).find(
                (block) => selection.head >= block.from && selection.head <= block.to,
              ) ?? { from: selection.from, to: selection.to, content: "" },
            );
          })
        }
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
