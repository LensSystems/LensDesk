import { history, undo } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { expect, it, vi } from "vitest";
import { replaceSpelling } from "./spelling-replace.ts";

function editor(doc: string, pos: number | null, readOnly = false) {
  const target = {
    state: EditorState.create({ doc, extensions: [history(), EditorState.readOnly.of(readOnly)] }),
    posAtCoords: vi.fn(() => pos),
    dispatch: vi.fn((spec: Parameters<EditorState["update"]>[0]) => {
      target.state = target.state.update(spec).state;
    }),
  };
  return target;
}
function originalRange(view: ReturnType<typeof editor>) {
  const pos = view.posAtCoords();
  const range = pos === null ? null : view.state.wordAt(pos);
  return range ? { from: range.from, to: range.to, doc: view.state.doc } : null;
}
it.each([
  ["holaa holaa", "holaa", "hola", "hola holaa"],
  ["árból árbol", "árból", "árbol", "árbol árbol"],
])("reemplaza solo el rango señalado: %s", (source, word, suggestion, expected) => {
  const view = editor(source, 2);
  expect(replaceSpelling(view, originalRange(view), word, suggestion)).toBe(true);
  expect(view.state.doc.toString()).toBe(expected);
  expect(view.dispatch).toHaveBeenCalledOnce();
  expect(view.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ userEvent: "input.spelling" }),
  );
  expect(
    undo({
      state: view.state,
      dispatch: (transaction) => {
        view.state = transaction.state;
      },
    }),
  ).toBe(true);
  expect(view.state.doc.toString()).toBe(source);
});
it("no reemplaza si no coincide, no hay posición o es solo lectura", () => {
  for (const view of [editor("otra holaa", 2), editor("holaa", null), editor("holaa", 2, true)]) {
    expect(replaceSpelling(view, originalRange(view), "holaa", "hola")).toBe(false);
    expect(view.dispatch).not.toHaveBeenCalled();
  }
});

it("conserva la aparición original aunque cambien las coordenadas", () => {
  const view = editor("holaa holaa", 8);
  const range = originalRange(view);
  view.posAtCoords.mockReturnValue(2);
  expect(replaceSpelling(view, range, "holaa", "hola")).toBe(true);
  expect(view.state.doc.toString()).toBe("holaa hola");
  expect(view.posAtCoords).toHaveBeenCalledOnce();
});
it("rechaza un documento cambiado aunque la palabra siga coincidiendo", () => {
  const view = editor("holaa holaa", 2);
  const range = originalRange(view);
  view.state = view.state.update({ changes: { from: 11, insert: "!" } }).state;
  expect(replaceSpelling(view, range, "holaa", "hola")).toBe(false);
  expect(view.dispatch).not.toHaveBeenCalled();
  expect(view.state.doc.toString()).toBe("holaa holaa!");
});
