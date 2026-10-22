import type { EditorState, Text, TransactionSpec } from "@codemirror/state";

export type SpellingRange = { from: number; to: number; doc: Text };

export function replaceSpelling(
  view: {
    state: EditorState;
    dispatch(spec: TransactionSpec): void;
  },
  range: SpellingRange | null,
  word: string,
  suggestion: string,
): boolean {
  if (view.state.readOnly || !word || !range || view.state.doc !== range.doc) return false;
  if (view.state.sliceDoc(range.from, range.to) !== word) return false;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: suggestion },
    userEvent: "input.spelling",
  });
  return true;
}
