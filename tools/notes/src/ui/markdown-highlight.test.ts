import { markdown } from "@codemirror/lang-markdown";
import { tags } from "@lezer/highlight";
import { EditorView } from "codemirror";
import { afterEach, describe, expect, it } from "vitest";
import { markdownHighlighting, markdownHighlightStyle } from "./markdown-highlight.ts";

let view: EditorView | null = null;
afterEach(() => {
  view?.destroy();
  view = null;
});

function classesOf(text: string, doc: string): string {
  view = new EditorView({
    doc,
    extensions: [markdown(), markdownHighlighting],
    parent: document.body,
  });
  const span = [...view.dom.querySelectorAll(".cm-line span")].find((node) =>
    node.textContent?.includes(text),
  );
  return span?.className ?? "";
}

describe("coloreado de Markdown", () => {
  it("marca títulos, negritas y código con el estilo del tema", () => {
    const heading = markdownHighlightStyle.style([tags.heading]);
    const strong = markdownHighlightStyle.style([tags.strong]);
    const code = markdownHighlightStyle.style([tags.monospace]);
    expect(heading && strong && code).toBeTruthy();
    expect(classesOf("Título", "# Título")).toContain(heading);
    expect(classesOf("fuerte", "texto **fuerte**")).toContain(strong);
    expect(classesOf("codigo", "uso `codigo` aquí")).toContain(code);
  });

  it("solo usa colores del tema, nunca valores fijos", () => {
    const rules = markdownHighlightStyle.module?.getRules() ?? "";
    expect(rules).toContain("var(--ld-code)");
    expect(rules).not.toContain("var(--ld-success)");
    expect(rules).not.toMatch(/#[\da-f]{3,8}\b|rgb\(/i);
  });
});
