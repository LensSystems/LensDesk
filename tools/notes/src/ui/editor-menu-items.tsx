import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import {
  type ContextMenuEntry,
  Link,
  ListChecks,
  Lock,
  Plus,
  Redo2,
  Table,
  Type,
  Undo2,
} from "@lensdesk/ui";
import type { TFunction } from "i18next";
import { applyMarkdownEdit, formatCommand } from "./editor-commands.ts";
import { editorShortcut } from "./editor-shortcut.ts";
import { FormatGlyph } from "./FormatGlyph.tsx";
import { insertKinds, insertMarkdown } from "./markdown-insert.ts";

const insertIcons = [
  "heading1",
  "heading2",
  "heading3",
  "bullet",
  "numbered",
  ListChecks,
  "quote",
  "codeBlock",
  Table,
  "separator",
  Link,
];
const formats = ["bold", "italic", "underline", "strike", "code", "link"] as const;

export function editorMenuItems(
  t: TFunction,
  editor: EditorView | null,
  readOnly: boolean,
  privateNote: boolean,
  onPassword: () => void,
): ContextMenuEntry[] {
  const shortcut = (action: string) => editorShortcut(t, action);
  const disabled = readOnly || !editor || editor.state.readOnly;
  const insertItems: ContextMenuEntry[] = [];
  insertKinds.forEach((kind, index) => {
    if ([3, 7].includes(index)) insertItems.push({ separator: true });
    const Icon = insertIcons[index] ?? Type;
    insertItems.push({
      label: t(`insert.${kind}`),
      icon:
        typeof Icon === "string" ? (
          <span className={kind === "codeBlock" ? "font-mono text-[10px]" : undefined}>
            {t(`insertGlyphs.${Icon}`)}
          </span>
        ) : (
          <Icon className="size-3.5" />
        ),
      disabled,
      onSelect: () => {
        if (editor)
          applyMarkdownEdit(
            editor,
            insertMarkdown(editor.state.doc.toString(), editor.state.selection.main, kind),
          );
      },
    });
  });
  insertItems.push(
    { separator: true },
    {
      label: t("insert.password"),
      icon: <Lock className="size-3.5" />,
      note: t("insert.privateOnly"),
      disabled: disabled || !privateNote,
      onSelect: onPassword,
    },
  );
  return [
    {
      label: t("undo"),
      icon: <Undo2 className="size-3.5" />,
      shortcut: shortcut("undo"),
      disabled: disabled || undoDepth(editor.state) === 0,
      onSelect: () => {
        if (editor) undo(editor);
      },
    },
    {
      label: t("redo"),
      icon: <Redo2 className="size-3.5" />,
      shortcut: shortcut("redo"),
      disabled: disabled || redoDepth(editor.state) === 0,
      onSelect: () => {
        if (editor) redo(editor);
      },
    },
    { separator: true },
    {
      label: t("format"),
      icon: (
        <span aria-hidden="true" className="grid size-4 place-items-center text-xs font-bold">
          {t("formatSymbol")}
        </span>
      ),
      contentClassName: "min-w-[294px]",
      items: formats.map((format) => {
        return {
          label: t(`formatLabels.${format}`),
          icon: <FormatGlyph format={format} />,
          shortcut: shortcut(format),
          disabled,
          onSelect: () => {
            if (editor) formatCommand(format)(editor);
          },
        };
      }),
    },
    {
      label: t("insert.title"),
      icon: <Plus className="size-3.5" />,
      contentClassName: "min-w-[294px]",
      items: insertItems,
    },
  ];
}
