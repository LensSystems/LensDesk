import { expect, it } from "vitest";
import { exportMarkdown, importMarkdown } from "./note-markdown.ts";

it.each([
  "````js\n# comentario\n```\n# aún código\n````\n",
  "~~~~sh\n# comentario\n~~~\n# aún código\n~~~~\n",
  "    # comentario\n    echo hola\n\t# otro comentario\n",
])("conserva el código y no toma encabezados posteriores: %s", (code) => {
  expect(importMarkdown(code, "archivo.md")).toEqual({ title: "archivo", body_md: code });
  const withHeading = `${code}   # Título ###\n\nTexto`;
  expect(importMarkdown(withHeading, "archivo.md")).toEqual({
    title: "archivo",
    body_md: withHeading,
  });
});

it("limita títulos sin separar pares sustitutos ni perder el encabezado", () => {
  const title = `${"a".repeat(199)}😀final`;
  const body = `# ${title}\n\nTexto`;
  expect(importMarkdown(body, "archivo.md")).toEqual({ title: "a".repeat(199), body_md: body });
  expect(importMarkdown("Texto", `${title}.md`)).toEqual({
    title: "a".repeat(199),
    body_md: "Texto",
  });
});

it.each([
  ["Título", "Cuerpo\n\n# Interno\nTexto\n"],
  ["", "# Encabezado del cuerpo\n"],
  ["Título", "\n\nTexto\r\n"],
  ["Título", ""],
  [" Título ", "Cuerpo"],
])("conserva título %s y cuerpo al exportar e importar", (title, body_md) => {
  // El backend guarda los títulos sin espacios en los extremos.
  expect(importMarkdown(exportMarkdown(title, body_md), "otro.md")).toEqual({
    title: title.trim(),
    body_md,
  });
});

it("toma el encabezado de la primera línea y si no, el nombre del archivo", () => {
  expect(importMarkdown("\n# Título\r\n\r\nDespués", "archivo.md")).toEqual({
    title: "Título",
    body_md: "\nDespués",
  });
  expect(importMarkdown("Antes\n# Título\n", "archivo.md")).toEqual({
    title: "archivo",
    body_md: "Antes\n# Título\n",
  });
  expect(importMarkdown("## Sección\nTexto", "mi.nota.markdown")).toEqual({
    title: "mi.nota",
    body_md: "## Sección\nTexto",
  });
});

it("exportar e importar conserva títulos que acaban en almohadilla", () => {
  for (const title of ["Tema ###", "Cierre #", "C#"])
    expect(importMarkdown(exportMarkdown(title, "cuerpo"), "x.md")).toEqual({
      title,
      body_md: "cuerpo",
    });
});

it("un título con almohadillas y espacios finales vuelve igual tras recortarlo", () => {
  for (const title of ["Tema ### ", "Tema #\t"])
    expect(importMarkdown(exportMarkdown(title, "cuerpo"), "x.md").title).toBe(title.trim());
});

it("un encabezado que no es la primera línea no se toma como título", () => {
  for (const body of [
    "<pre>\n# instrucción literal\n</pre>\n",
    "Texto\n# Encabezado\n",
    "<!--\n# nota\n-->\n",
  ])
    expect(importMarkdown(body, "archivo.md")).toEqual({ title: "archivo", body_md: body });
});
