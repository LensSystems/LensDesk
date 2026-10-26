import { describe, expect, it } from "vitest";
import { insertMarkdown } from "./markdown-insert.ts";

describe("insertar Markdown", () => {
  it("convierte líneas completas, sustituye prefijos y omite las vacías", () => {
    const text = "antes\n# uno\n- dos\n\nfin";
    const edit = insertMarkdown(text, { from: 8, to: 18 }, "heading2");
    expect(edit.text).toBe("antes\n## uno\n## dos\n\nfin");
    expect(insertMarkdown(edit.text, edit.range, "heading2").text).toBe("antes\nuno\ndos\n\nfin");
  });
  it("numera consecutivamente y alterna listas", () => {
    const edit = insertMarkdown("uno\n\ndos\ntres", { from: 0, to: 13 }, "numbered");
    expect(edit.text).toBe("1. uno\n\n2. dos\n3. tres");
    expect(insertMarkdown(edit.text, edit.range, "numbered").text).toBe("uno\n\ndos\ntres");
  });
  it.each([
    ["bullet", "- "],
    ["task", "- [ ] "],
    ["quote", "> "],
  ] as const)("alterna %s en la línea del cursor", (kind, prefix) => {
    const edit = insertMarkdown("uno", { from: 1, to: 1 }, kind);
    expect(edit).toEqual({
      text: `${prefix}uno`,
      range: { from: prefix.length + 1, to: prefix.length + 1 },
    });
    expect(insertMarkdown(edit.text, edit.range, kind).text).toBe("uno");
  });
  it("no incluye la siguiente línea si la selección termina al comienzo", () => {
    expect(insertMarkdown("uno\ndos", { from: 0, to: 4 }, "heading1").text).toBe("# uno\ndos");
  });
  it("envuelve código entre líneas en blanco y deja el cursor dentro", () => {
    expect(insertMarkdown("antes\ncódigo\ndespués", { from: 7, to: 9 }, "codeBlock")).toEqual({
      text: "antes\n\n```\ncódigo\n```\n\ndespués",
      range: { from: 11, to: 11 },
    });
  });
  it("inserta una tabla con dos filas y dos columnas y cursor en la primera celda", () => {
    const edit = insertMarkdown("", { from: 0, to: 0 }, "table");
    expect(edit.text).toBe("|  |  |\n| --- | --- |\n|  |  |\n|  |  |\n\n");
    expect(edit.range).toEqual({ from: 2, to: 2 });
  });
  it("inserta un separador aislado", () => {
    expect(insertMarkdown("", { from: 0, to: 0 }, "separator").text).toBe("---\n\n");
  });
  it("reutiliza el enlace con la selección", () => {
    expect(insertMarkdown("sitio", { from: 0, to: 5 }, "link").text).toContain("[sitio](url)");
  });
  it("tabla y separador se insertan debajo de una línea con texto sin borrarla", () => {
    const table = insertMarkdown("hola\nfin", { from: 2, to: 2 }, "table");
    expect(table.text).toBe("hola\n\n|  |  |\n| --- | --- |\n|  |  |\n|  |  |\n\nfin");
    expect(table.range).toEqual({ from: 8, to: 8 });
    expect(insertMarkdown("hola", { from: 4, to: 4 }, "separator").text).toBe("hola\n\n---\n\n");
  });
  it("en una línea vacía sin selección escribe el prefijo", () => {
    expect(insertMarkdown("", { from: 0, to: 0 }, "heading2")).toEqual({
      text: "## ",
      range: { from: 3, to: 3 },
    });
    expect(insertMarkdown("uno\n\n", { from: 5, to: 5 }, "task").text).toBe("uno\n\n- [ ] ");
    expect(insertMarkdown("", { from: 0, to: 0 }, "numbered").text).toBe("1. ");
  });
  it("convierte tareas en viñetas sin dejar la casilla", () => {
    expect(insertMarkdown("- [ ] pendiente", { from: 0, to: 0 }, "bullet").text).toBe(
      "- pendiente",
    );
    expect(insertMarkdown("- [x] listo", { from: 0, to: 0 }, "bullet").text).toBe("- listo");
    expect(insertMarkdown("- uno", { from: 0, to: 0 }, "bullet").text).toBe("uno");
  });
  it("con la nota empezando por un salto y el cursor al inicio usa la primera línea", () => {
    expect(insertMarkdown("\ntexto", { from: 0, to: 0 }, "heading2").text).toBe("## \ntexto");
  });
  it("conserva las casillas marcadas al alternar tareas", () => {
    const mixed = "- [x] hecho\n- [ ] pendiente\notra";
    const edit = insertMarkdown(mixed, { from: 0, to: mixed.length }, "task");
    expect(edit.text).toBe("- [x] hecho\n- [ ] pendiente\n- [ ] otra");
    expect(insertMarkdown(edit.text, edit.range, "task").text).toBe("hecho\npendiente\notra");
  });
});
