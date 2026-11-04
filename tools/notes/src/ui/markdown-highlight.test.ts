import { readFileSync } from "node:fs";
import { markdown } from "@codemirror/lang-markdown";
import { forceParsing } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { EditorView } from "codemirror";
import { afterEach, describe, expect, it } from "vitest";
import { markdownHighlighting, markdownHighlightStyle } from "./markdown-highlight.ts";

const styles = readFileSync("tools/notes/src/ui/styles.css", "utf8");
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
    expect(rules).toContain("font-size: 11.5px");
    expect(rules).toContain("font-weight: 500");
    expect(rules).not.toMatch(/#[\da-f]{3,8}\b|rgb\(/i);
  });
});

describe("espaciado de bloques Markdown", () => {
  it("marca solo los inicios de títulos, listas, citas, código y separadores", () => {
    const lines = [
      "# Título",
      "Párrafo",
      "continuación",
      "- uno",
      "- dos",
      "> cita",
      "> continuación",
      "1. uno",
      "2. dos",
      "```ts",
      "# código",
      "```",
      "---",
      "Título setext",
      "===",
      "",
      "    código indentado",
      "    continuación",
      "",
      "Tras una línea en blanco",
    ];
    view = new EditorView({
      doc: lines.join("\n"),
      extensions: [markdown(), markdownHighlighting],
      parent: document.body,
    });
    // Con la máquina cargada el analizador puede no terminar en su plazo: se fuerza el árbol completo.
    forceParsing(view, view.state.doc.length, 5000);
    const starts: number[] = [];
    view.state.facet(EditorView.decorations).forEach((decorations) => {
      if (typeof decorations === "function") return;
      decorations.between(0, view?.state.doc.length ?? 0, (from, _to, decoration) => {
        if (decoration.spec.class === "cm-block-start")
          starts.push(view?.state.doc.lineAt(from).number ?? 0);
      });
    });
    expect(starts).toEqual([2, 4, 6, 8, 10, 13, 14]);
  });

  it("actualiza las clases al convertir un párrafo en título y viceversa", () => {
    view = new EditorView({
      doc: "```\nx\n```\nTexto",
      extensions: [markdown(), markdownHighlighting],
      parent: document.body,
    });
    expect(view.dom.querySelector(".cm-line.cm-block-start")?.textContent).toBe("Texto");
    view.dispatch({ changes: { from: 10, insert: "# " } });
    expect(view.dom.querySelector(".cm-line.cm-block-start")?.textContent).toBe("# Texto");
    view.dispatch({ changes: { from: 10, to: 12 } });
    expect(view.dom.querySelector(".cm-line.cm-block-start")?.textContent).toBe("Texto");
  });
});

it("aplica estilos completos a títulos, vallas, citas y marcas de tareas", () => {
  view = new EditorView({
    doc: "## Título\n- [x] Hecho\n- [ ] Pendiente\n> Cita\n```bash\npnpm test\n```",
    extensions: [markdown(), markdownHighlighting],
    parent: document.body,
  });
  expect(view.dom.querySelector(".cm-md-heading")?.textContent).toBe("## Título");
  expect([...view.dom.querySelectorAll(".cm-md-code")].map((node) => node.textContent)).toEqual([
    "```bash",
    "pnpm test",
    "```",
  ]);
  expect(view.dom.querySelector(".cm-md-quote")?.textContent).toBe("> Cita");
  expect(
    [...view.dom.querySelectorAll(".cm-md-list-mark")].map((node) => node.textContent),
  ).toEqual(["- [x]", "- [ ]"]);
});

it("mantiene las medidas del editor y separa código de los estados de éxito", () => {
  expect(styles).toMatch(
    /\.code-editor \.cm-lineNumbers \.cm-gutterElement\s*\{[^}]*text-align: center;[^}]*width: 40px;[^}]*padding-right: 0;[^}]*padding-left: 0;/s,
  );
  expect(styles).toMatch(/\.cm-scroller\s*\{[^}]*font-size: 13px;[^}]*line-height: 1.7/s);
  expect(styles).toMatch(
    /\.cm-line\.cm-block-start,\s*\.code-editor \.cm-gutterElement\.cm-block-start\s*\{\s*padding-top: 10px/,
  );
  expect(styles).toMatch(/\.cm-gutterElement\.cm-block-start\s*\{\s*padding-top: 10px/);
  expect(styles).toMatch(
    /\.cm-md-heading span\s*\{\s*color: var\(--ld-accent\);\s*font-weight: 500/,
  );
  expect(styles).toMatch(/\.cm-md-code span\s*\{\s*color: var\(--ld-code\);\s*font-weight: 400/);
  expect(styles).toMatch(
    /\.cm-md-list-mark span\s*\{\s*color: var\(--ld-text\);\s*text-decoration: none/,
  );
  // La tipografía compartida de lectura se verifica con estilos calculados en markdown-reading.spec.ts.
});
