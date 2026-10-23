import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import {
  Bold,
  Braces,
  Code,
  type ContextMenuEntry,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Lock,
  Minus,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Table,
  Type,
  Underline,
  Undo2,
} from "@lensdesk/ui";
import type { TFunction } from "i18next";
import { applyMarkdownEdit, formatCommand } from "./editor-commands.ts";
import { insertKinds, insertMarkdown } from "./markdown-insert.ts";

const insertIcons = [
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Braces,
  Table,
  Minus,
  Link,
];
const formats = ["bold", "italic", "underline", "strike", "code", "link"] as const;
const formatIcons = [Bold, Italic, Underline, Strikethrough, Code, Link];

export function editorMenuItems(
  t: TFunction,
  editor: EditorView | null,
  readOnly: boolean,
  privateNote: boolean,
  onPassword: () => void,
): ContextMenuEntry[] {
  const mac = /Mac/.test(navigator.platform);
  const shortcut = (action: string) => t(`shortcuts.${mac ? "mac" : "other"}.${action}`);
  const disabled = readOnly || !editor || editor.state.readOnly;
  const insertItems: ContextMenuEntry[] = [];
  insertKinds.forEach((kind, index) => {
    if ([3, 7].includes(index)) insertItems.push({ separator: true });
    const Icon = insertIcons[index] ?? Type;
    insertItems.push({
      label: t(`insert.${kind}`),
      icon: <Icon className="size-4" />,
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
      icon: <Lock className="size-4" />,
      note: t("insert.privateOnly"),
      disabled: disabled || !privateNote,
      onSelect: onPassword,
    },
  );
  return [
    {
      label: t("undo"),
      icon: <Undo2 className="size-4" />,
      shortcut: shortcut("undo"),
      disabled: disabled || undoDepth(editor.state) === 0,
      onSelect: () => {
        if (editor) undo(editor);
      },
    },
    {
      label: t("redo"),
      icon: <Redo2 className="size-4" />,
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
      items: formats.map((format, index) => {
        const Icon = formatIcons[index] ?? Type;
        return {
          label: t(`formatLabels.${format}`),
          icon: <Icon className="size-4" />,
          shortcut: format === "strike" ? undefined : shortcut(format),
          disabled,
          onSelect: () => {
            if (editor) formatCommand(format)(editor);
          },
        };
      }),
    },
    { label: t("insert.title"), icon: <Plus className="size-4" />, items: insertItems },
  ];
}
