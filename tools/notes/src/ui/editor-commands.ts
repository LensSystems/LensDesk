import type { EditorView } from "@codemirror/view";
import { type Format, insertLink, marks, toggleMarks } from "./markdown-commands.ts";

export function formatCommand(format: Format) {
  return (view: EditorView): boolean => {
    const text = view.state.doc.toString();
    const range = view.state.selection.main;
    const edit =
      format === "link"
        ? insertLink(text, range)
        : toggleMarks(text, range, marks[format][0], marks[format][1]);
    let from = 0;
    while (from < text.length && from < edit.text.length && text[from] === edit.text[from]) from++;
    let to = text.length;
    let end = edit.text.length;
    while (to > from && end > from && text[to - 1] === edit.text[end - 1]) {
      to--;
      end--;
    }
    view.dispatch({
      changes: { from, to, insert: edit.text.slice(from, end) },
      selection: { anchor: edit.range.from, head: edit.range.to },
      userEvent: "input.format",
      scrollIntoView: true,
    });
    return true;
  };
}

export const formatKeymap = [
  { key: "Mod-b", run: formatCommand("bold") },
  { key: "Mod-i", run: formatCommand("italic") },
  { key: "Mod-u", run: formatCommand("underline") },
  { key: "Mod-e", run: formatCommand("code") },
  { key: "Mod-k", run: formatCommand("link") },
];
