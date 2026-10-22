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

describe("espaciado de bloques Markdown", () => {
  it("marca solo los inicios de títulos, listas, citas, código y separadores", () => {
    const lines = [
      "# Título",
      "",
      "Párrafo",
      "continuación",
      "",
      "- uno",
      "- dos",
      "",
      "> cita",
      "> continuación",
      "",
      "1. uno",
      "2. dos",
      "",
      "```ts",
      "# código",
      "```",
      "",
      "---",
      "",
      "Título setext",
      "===",
      "",
      "    código indentado",
      "    continuación",
    ];
    view = new EditorView({
      doc: lines.join("\n"),
      extensions: [markdown(), markdownHighlighting],
      parent: document.body,
    });
    const starts: number[] = [];
    view.state.facet(EditorView.decorations).forEach((decorations) => {
      if (typeof decorations === "function") return;
      decorations.between(0, view?.state.doc.length ?? 0, (from, _to, decoration) => {
        if (decoration.spec.class === "cm-block-start")
          starts.push(view?.state.doc.lineAt(from).number ?? 0);
      });
    });
    expect(starts).toEqual([1, 6, 9, 12, 15, 19, 21, 24]);
  });

  it("actualiza las clases al convertir un párrafo en título y viceversa", () => {
    view = new EditorView({
      doc: "Texto",
      extensions: [markdown(), markdownHighlighting],
      parent: document.body,
    });
    expect(view.dom.querySelector(".cm-block-start")).toBeNull();
    view.dispatch({ changes: { from: 0, insert: "# " } });
    expect(view.dom.querySelector(".cm-line.cm-block-start")?.textContent).toBe("# Texto");
    view.dispatch({ changes: { from: 0, to: 2 } });
    expect(view.dom.querySelector(".cm-block-start")).toBeNull();
  });
});
