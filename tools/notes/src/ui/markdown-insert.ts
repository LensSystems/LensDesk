import { insertLink, lineStart, type MarkdownEdit, type TextRange } from "./markdown-commands.ts";

export const insertKinds = [
  "heading1",
  "heading2",
  "heading3",
  "heading4",
  "heading5",
  "heading6",
  "bullet",
  "numbered",
  "task",
  "quote",
  "codeBlock",
  "table",
  "separator",
  "link",
] as const;
export type InsertKind = (typeof insertKinds)[number];
const task = /^- \[[ xX]\] /;
const blockPrefix = /^(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s?)*/;

export function insertMarkdown(text: string, range: TextRange, kind: InsertKind): MarkdownEdit {
  if (kind === "link") return insertLink(text, range);
  const start = lineStart(text, range.from);
  const last = range.to > range.from && text[range.to - 1] === "\n" ? range.to - 1 : range.to;
  const newline = text.indexOf("\n", last);
  const end = newline < 0 ? text.length : newline;
  if (kind === "codeBlock" || kind === "table" || kind === "separator") {
    // Tabla y separador van debajo de la línea actual si tiene texto; no la sustituyen.
    const below = kind !== "codeBlock" && text.slice(start, end).trim() !== "";
    const cut = below ? end : start;
    const before = text.slice(0, cut);
    const after = text.slice(end);
    const padBefore =
      !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const padAfter = after ? (after.startsWith("\n\n") ? "" : "\n") : "\n\n";
    const body = below ? "" : text.slice(start, end);
    const block =
      kind === "codeBlock"
        ? `\`\`\`\n${body}\n\`\`\``
        : kind === "table"
          ? "|  |  |\n| --- | --- |\n|  |  |\n|  |  |"
          : "---";
    const offset = kind === "codeBlock" ? 4 : kind === "table" ? 2 : 3;
    const at = cut + padBefore.length + offset;
    return { text: before + padBefore + block + padAfter + after, range: { from: at, to: at } };
  }
  const lines = text.slice(start, end).split("\n");
  const marker = kind.startsWith("heading")
    ? `${"#".repeat(Number(kind.slice(7)))} `
    : { bullet: "- ", numbered: "1. ", task: "- [ ] ", quote: "> " }[
        kind as "bullet" | "numbered" | "task" | "quote"
      ];
  const matches = (line: string) =>
    kind === "numbered"
      ? /^\d+\. /.test(line)
      : kind === "bullet"
        ? /^- (?!\[[ xX]\] )/.test(line)
        : kind === "task"
          ? task.test(line)
          : line.startsWith(marker);
  // Sin selección en una línea vacía, se escribe el prefijo para empezar el bloque.
  if (range.from === range.to && !text.slice(start, end).trim()) {
    const prefix = kind === "numbered" ? "1. " : marker;
    const at = start + prefix.length;
    return { text: text.slice(0, start) + prefix + text.slice(end), range: { from: at, to: at } };
  }
  const nonempty = lines.filter((line) => line.trim());
  const remove = nonempty.length > 0 && nonempty.every(matches);
  let number = 0;
  const replacement = lines
    .map((line) => {
      if (!line.trim()) return line;
      if (remove)
        return line.replace(
          kind === "numbered"
            ? /^\d+\. /
            : kind === "task"
              ? task
              : new RegExp(`^${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
          "",
        );
      // Las tareas ya existentes conservan su casilla (marcada o no).
      if (kind === "task" && task.test(line)) return line;
      const prefix = kind === "numbered" ? `${++number}. ` : marker;
      return prefix + line.replace(blockPrefix, "");
    })
    .join("\n");
  const cursor = range.from === range.to;
  const at = Math.min(
    start + replacement.length,
    Math.max(start, range.from + replacement.length - (end - start)),
  );
  return {
    text: text.slice(0, start) + replacement + text.slice(end),
    range: cursor ? { from: at, to: at } : { from: start, to: start + replacement.length },
  };
}
