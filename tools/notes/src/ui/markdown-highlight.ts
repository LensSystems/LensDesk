import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { RangeSet, StateField } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { Decoration, EditorView, GutterMarker, gutterLineClass } from "@codemirror/view";
import { tags } from "@lezer/highlight";

// Colores de sintaxis del editor: solo tokens del tema, para que sigan al modo claro u oscuro.
export const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--ld-accent)", fontWeight: "600" },
  { tag: tags.strong, color: "var(--ld-warning)", fontWeight: "700" },
  { tag: tags.emphasis, color: "var(--ld-warning)", fontStyle: "italic" },
  { tag: tags.monospace, color: "var(--ld-code)" },
  { tag: tags.quote, color: "var(--ld-text-muted)" },
  { tag: [tags.link, tags.url], color: "var(--ld-accent)", textDecoration: "underline" },
  { tag: [tags.processingInstruction, tags.meta], color: "var(--ld-text-muted)" },
]);

const blockStart = Decoration.line({ class: "cm-block-start" });
const blockNames =
  /^(?:ATXHeading[1-6]|SetextHeading[12]|BulletList|OrderedList|Blockquote|FencedCode|CodeBlock|HorizontalRule)$/;

// El número de línea recibe la misma clase para quedar alineado con su texto.
class BlockStartGutter extends GutterMarker {
  override elementClass = "cm-block-start";
}
const blockStartGutter = new BlockStartGutter();

type BlockSpacing = { lines: DecorationSet; gutter: RangeSet<GutterMarker> };

const blockSpacing = StateField.define<BlockSpacing>({
  create: blockDecorations,
  // Solo se recalcula si cambia el texto o avanza el análisis, no al mover el cursor.
  update: (value, transaction) =>
    transaction.docChanged || syntaxTree(transaction.state) !== syntaxTree(transaction.startState)
      ? blockDecorations(transaction.state)
      : value,
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value.lines),
    gutterLineClass.from(field, (value) => value.gutter),
  ],
});

function blockDecorations(state: Parameters<typeof syntaxTree>[0]): BlockSpacing {
  const starts = new Set<number>();
  syntaxTree(state).iterate({
    enter(node) {
      if (blockNames.test(node.name)) starts.add(state.doc.lineAt(node.from).from);
    },
  });
  const sorted = [...starts].sort((a, b) => a - b);
  return {
    lines: Decoration.set(sorted.map((from) => blockStart.range(from))),
    gutter: RangeSet.of(sorted.map((from) => blockStartGutter.range(from))),
  };
}

export const markdownHighlighting = [syntaxHighlighting(markdownHighlightStyle), blockSpacing];
