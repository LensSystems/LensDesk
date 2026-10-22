import { type EditorState, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { credentialFences } from "./credential-fences.ts";

class Mask extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.textContent = "•••••••";
    return span;
  }
}
export function secretRanges(source: string) {
  const ranges: { from: number; to: number }[] = [];
  for (const fence of credentialFences(source)) {
    let offset = source.indexOf("\n", fence.from) + 1;
    for (const line of source.slice(offset, fence.to).split("\n")) {
      let start = -1;
      // La vista previa lee la valla sin sangría ni marcas de cita (">"): aquí se aceptan
      // esos prefijos para tapar todo lo que ella reconoce. Tapar de más no hace daño.
      const key = /^[ \t>]*(password|secret):/.exec(line);
      const colon = key ? key[0].length - 1 : -1;
      if (key?.[1] === "password") start = colon + 1;
      if (key?.[1] === "secret") {
        for (let i = colon + 1; i < line.length; i++) {
          if (line[i] === "\\") {
            i++;
            continue;
          }
          if (line[i] === "|") {
            start = i + 1;
            break;
          }
        }
      }
      if (start >= 0 && start < line.length)
        ranges.push({ from: offset + start, to: offset + line.length });
      offset += line.length + 1;
    }
  }
  return ranges;
}
function masks(state: EditorState): DecorationSet {
  return Decoration.set(
    secretRanges(state.doc.toString()).map(({ from, to }) =>
      Decoration.replace({ widget: new Mask() }).range(from, to),
    ),
  );
}
export const credentialMask = StateField.define<DecorationSet>({
  create: masks,
  update: (value, transaction) => (transaction.docChanged ? masks(transaction.state) : value),
  provide: (field) => EditorView.decorations.from(field),
});
