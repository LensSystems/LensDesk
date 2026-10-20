import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
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

export const markdownHighlighting = syntaxHighlighting(markdownHighlightStyle);
