import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { RangeSet, StateField } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { Decoration, EditorView, GutterMarker, gutterLineClass } from "@codemirror/view";
import { tags } from "@lezer/highlight";

// Colores de sintaxis del editor: solo tokens del tema, para que sigan al modo claro u oscuro.
export const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--ld-accent)", fontWeight: "500" },
  { tag: tags.strong, color: "var(--ld-warning)", fontWeight: "700" },
  { tag: tags.emphasis, color: "var(--ld-text-muted)", fontStyle: "italic", fontSize: "11.5px" },
  { tag: tags.monospace, color: "var(--ld-code)" },
  { tag: tags.quote, color: "var(--ld-text-muted)" },
  { tag: [tags.link, tags.url], color: "var(--ld-accent)", textDecoration: "underline" },
  { tag: [tags.processingInstruction], color: "var(--ld-text-muted)" },
  { tag: tags.list, color: "var(--ld-text)" },
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
  const decorations: ReturnType<typeof blockStart.range>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (
        (blockNames.test(node.name) || node.name === "Paragraph") &&
        node.node.parent?.name === "Document" &&
        node.from > 0 &&
        // Una línea en blanco ya separa los bloques: no se suma el medio renglón.
        state.doc.line(state.doc.lineAt(node.from).number - 1).text.trim() !== ""
      )
        starts.add(state.doc.lineAt(node.from).from);
      const className = /^ATXHeading|^SetextHeading/.test(node.name)
        ? "cm-md-heading"
        : /^(FencedCode|CodeBlock)$/.test(node.name)
          ? "cm-md-code"
          : node.name === "Blockquote"
            ? "cm-md-quote"
            : null;
      if (className) {
        for (let pos = state.doc.lineAt(node.from).from; pos < node.to; ) {
          decorations.push(Decoration.line({ class: className }).range(pos));
          pos = state.doc.lineAt(pos).to + 1;
        }
        return false;
      }
      if (node.name === "ListItem") {
        const prefix = /^(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\])?/.exec(
          state.doc.sliceString(node.from, node.to),
        );
        if (prefix)
          decorations.push(
            Decoration.mark({ class: "cm-md-list-mark" }).range(
              node.from,
              node.from + prefix[0].length,
            ),
          );
      }
    },
  });
  const sorted = [...starts].sort((a, b) => a - b);
  return {
    lines: Decoration.set([...decorations, ...sorted.map((from) => blockStart.range(from))], true),
    gutter: RangeSet.of(sorted.map((from) => blockStartGutter.range(from))),
  };
}

export const markdownHighlighting = [syntaxHighlighting(markdownHighlightStyle), blockSpacing];
