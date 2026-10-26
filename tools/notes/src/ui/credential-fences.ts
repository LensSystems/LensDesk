import MarkdownIt from "markdown-it";

// Mismas opciones de bloque que la vista previa (preview.ts): si no, un bloque HTML puede hacer que
// la vista previa vea una credencial que aquí no se detecta y su secreto quede sin tapar.
const markdown = new MarkdownIt({ html: true, linkify: true, breaks: true });
export function credentialFences(source: string) {
  const offsets = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") offsets.push(i + 1);
  return markdown
    .parse(source, {})
    .filter((token) => token.type === "fence" && token.info.trim() === "credential" && token.map)
    .map((token) => ({
      from: offsets[token.map?.[0] ?? 0] ?? 0,
      to: offsets[token.map?.[1] ?? offsets.length] ?? source.length,
      content: token.content,
    }));
}

// Dónde insertar un bloque para que se reconozca como credencial (y su secreto quede tapado): en la
// posición pedida; si cae dentro de otro bloque (código, HTML) o de uno sin cerrar, al final; y si
// tampoco, al principio, donde nada anterior puede absorberlo.
export function credentialInsertion(source: string, from: number, to: number, block: string) {
  const end = source.length;
  const tail = source.endsWith("\n\n") || end === 0 ? "" : source.endsWith("\n") ? "\n" : "\n\n";
  const candidates = [
    { from, to, insert: `\n${block}\n`, start: from + 1 },
    { from: end, to: end, insert: `${tail}${block}\n`, start: end + tail.length },
    { from: 0, to: 0, insert: `${block}\n\n`, start: 0 },
  ];
  for (const { start, ...change } of candidates) {
    const next = source.slice(0, change.from) + change.insert + source.slice(change.to);
    if (credentialFences(next).some((fence) => fence.from === start)) return change;
  }
  return null;
}
