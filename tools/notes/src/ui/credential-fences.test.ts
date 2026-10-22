import { expect, it } from "vitest";
import { credentialFences, credentialInsertion } from "./credential-fences.ts";
import { secretRanges } from "./credential-mask.ts";

const block = "```credential\npassword: oculta\n```";

function insertAt(source: string, marker: string) {
  const at = source.indexOf(marker);
  const change = credentialInsertion(source.replace(marker, ""), at, at, block);
  if (!change) throw new Error("Sin posición segura");
  const clean = source.replace(marker, "");
  return clean.slice(0, change.from) + change.insert + clean.slice(change.to);
}

it.each([
  ["texto normal", "Hola|\n\nMundo\n"],
  ["dentro de otro bloque de código", "```text\nlínea|\n```\n"],
  ["dentro de un bloque HTML", "<div>\nhtml|\n</div>\n"],
  ["dentro de una cita", "> cita|\n"],
  ["en una nota que acaba con una valla sin cerrar", "```text\nsin cerrar|"],
  ["en una nota que acaba con un comentario HTML sin cerrar", "<!--\ncomentario|"],
])("la credencial insertada en %s se reconoce y su secreto queda tapado", (_name, source) => {
  const result = insertAt(source, "|");
  expect(credentialFences(result)).toHaveLength(1);
  expect(secretRanges(result).map(({ from, to }) => result.slice(from, to).trim())).toEqual([
    "oculta",
  ]);
});

it("inserta en el sitio pedido cuando allí se reconoce", () => {
  expect(credentialInsertion("A\n\nB", 1, 1, block)).toEqual({
    from: 1,
    to: 1,
    insert: `\n${block}\n`,
  });
});
