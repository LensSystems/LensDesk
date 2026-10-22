import type { EditorView } from "@codemirror/view";
import { ContextMenu } from "@lensdesk/ui";
import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { applyMarkdownEdit } from "./editor-commands.ts";
import { insertKinds, insertMarkdown } from "./markdown-insert.ts";

export function EditorMenu({
  children,
  view,
}: {
  children: ReactNode;
  view: RefObject<EditorView | null>;
}) {
  const { t } = useTranslation();
  return (
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
        { label: t("insert.password"), disabled: true, onSelect: () => {} },
      ]}
    >
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </ContextMenu>
  );
}
