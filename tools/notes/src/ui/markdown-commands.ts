// Inicio de la línea de `at` (lastIndexOf con -1 miraría la posición 0).
export function lineStart(text: string, at: number): number {
  return at <= 0 ? 0 : text.lastIndexOf("\n", at - 1) + 1;
}

export type TextRange = { from: number; to: number };
export type MarkdownEdit = { text: string; range: TextRange };
export const marks = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  underline: ["<u>", "</u>"],
  strike: ["~~", "~~"],
  code: ["`", "`"],
} as const;
export type Format = keyof typeof marks | "link";

function run(text: string, at: number, step: 1 | -1): number {
  let count = 0;
  let index = step === 1 ? at : at - 1;
  while (index >= 0 && index < text.length && text[index] === "*") {
    count++;
    index += step;
  }
  return count;
}

// Con asteriscos, una serie de 1 o 3 incluye cursiva y una de 2 o más incluye negrita.
function hasMark(before: number, after: number, open: string): boolean {
  if (open === "*") return before % 2 === 1 && after % 2 === 1;
  if (open === "**") return before >= 2 && after >= 2;
  return true;
}

// La marca solo envuelve el texto si no vuelve a cerrarse dentro (p. ej. «**uno** y **dos**»).
// Con asteriscos se admiten marcas de la otra clase anidadas por pares: «*uno **dos** tres*».
function wrapsWhole(inner: string, close: string, stars: boolean): boolean {
  if (!stars) return !inner.includes(close);
  // Los asteriscos dentro de código en línea o escapados son texto, no marcas.
  const plain = inner.replace(/`[^`]*`/g, "").replace(/\\\*/g, "");
  const runs = plain.match(/\*+/g)?.map((match) => match.length) ?? [];
  const nested = close === "*" ? 2 : 1;
  return runs.length % 2 === 0 && runs.every((length) => length === nested);
}

// Prefijos de bloque que no deben quedar dentro de las marcas.
const prefix = /^[ \t]*(?:(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?|>[ \t]?|#{1,6}[ \t]+)*/;

export function toggleMarks(
  text: string,
  range: TextRange,
  open: string,
  close = open,
): MarkdownEdit {
  // Las líneas en blanco de los extremos de la selección no cuentan.
  const raw = text.slice(range.from, range.to);
  const lead = raw.match(/^(?:[ \t]*\n)+/)?.[0].length ?? 0;
  const tail = raw.slice(lead).match(/(?:\n[ \t]*)+$/)?.[0].length ?? 0;
  const from = range.from + lead;
  const to = Math.max(from, range.to - tail);
  const selected = text.slice(from, to);
  if (selected.trim().includes("\n")) {
    // Con varias líneas se trabaja con líneas completas: así ninguna marca ni código queda cortado.
    const lineFrom = lineStart(text, from);
    const lineEnd = text[to - 1] === "\n" ? to : text.indexOf("\n", to);
    return toggleLines(
      text,
      { from: lineFrom, to: lineEnd === -1 ? text.length : lineEnd },
      open,
      close,
    );
  }
  if (from === 0 || text[from - 1] === "\n") {
    if (isStructural(selected)) return { text, range: { from, to } };
    if (selected.match(prefix)?.[0]) return toggleLines(text, { from, to }, open, close);
  }
  return toggleInline(text, { from, to }, open, close);
}

// Separadores y filas de tabla (con o sin barras exteriores) dejarían de reconocerse.
function isStructural(line: string): boolean {
  return /^[ \t]*([-*_][ \t]*){3,}$/.test(line) || line.includes("|");
}

function toggleInline(
  text: string,
  { from, to }: TextRange,
  open: string,
  close: string,
): MarkdownEdit {
  const selected = text.slice(from, to);
  if (open === "`") return toggleCode(text, { from, to });
  const stars = open.startsWith("*");
  if (
    from >= open.length &&
    text.slice(from - open.length, from) === open &&
    text.slice(to, to + close.length) === close &&
    wrapsWhole(selected, close, stars) &&
    (!stars || hasMark(run(text, from, -1), run(text, to, 1), open))
  ) {
    return {
      text: text.slice(0, from - open.length) + selected + text.slice(to + close.length),
      range: { from: from - open.length, to: to - open.length },
    };
  }
  if (
    selected.length >= open.length + close.length &&
    selected.startsWith(open) &&
    selected.endsWith(close) &&
    wrapsWhole(selected.slice(open.length, -close.length), close, stars) &&
    (!stars || hasMark(run(selected, 0, 1), run(selected, selected.length, -1), open))
  ) {
    return {
      text: text.slice(0, from) + selected.slice(open.length, -close.length) + text.slice(to),
      range: { from, to: to - open.length - close.length },
    };
  }
  if (cutsCode(text, from, to)) return { text, range: { from, to } };
  // Los espacios de los extremos quedan fuera: «**hola **mundo» no se mostraría en negrita.
  const start = selected.trim() ? from + selected.length - selected.trimStart().length : from;
  const end = selected.trim() ? to - (selected.length - selected.trimEnd().length) : to;
  const inner = withoutMark(text.slice(start, end), open, close);
  const outside =
    text.slice(start - open.length, start) === open &&
    text.slice(end, end + close.length) === close;
  if (inner !== text.slice(start, end) && start >= open.length && outside) {
    // Ya estaba dentro de la misma marca: basta con quitar las de dentro.
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      range: { from: start, to: start + inner.length },
    };
  }
  // Si un extremo cae dentro de una marca igual de la misma línea, la selección la abarca entera.
  let wideFrom = start;
  let wideTo = end;
  const spans = markSpans(text, start, end, open, close);
  const around = spans.find((span) => span.from < start && span.to > end);
  if (around) {
    // Toda la selección está dentro de la marca: se le quita solo a ella.
    // Si otra marca cruza los límites, dividir dejaría asteriscos sueltos: no se cambia nada.
    const pieces = [
      text.slice(around.from + open.length, start),
      text.slice(start, end),
      text.slice(end, around.to - close.length),
    ];
    const loose = (value: string) =>
      (value.replace(/`[^`]*`/g, "").match(/\*+/g) ?? []).length % 2 === 1;
    if (pieces.some(loose)) return { text, range: { from: start, to: end } };
    const part = (value: string) => {
      const body = value.trim();
      if (!body) return value;
      const lead = value.slice(0, value.length - value.trimStart().length);
      const tail = value.slice(value.trimEnd().length);
      return lead + open + body + close + tail;
    };
    const left = part(text.slice(around.from + open.length, start));
    const right = part(text.slice(end, around.to - close.length));
    const middle = text.slice(start, end);
    return {
      text: text.slice(0, around.from) + left + middle + right + text.slice(around.to),
      range: { from: around.from + left.length, to: around.from + left.length + middle.length },
    };
  }
  for (const span of spans) {
    if (span.from < wideFrom && span.to > wideFrom) wideFrom = span.from;
    if (span.from < wideTo && span.to > wideTo) wideTo = span.to;
  }
  if (wideFrom !== start || wideTo !== end) {
    const merged = withoutMark(text.slice(wideFrom, wideTo), open, close);
    return {
      text: text.slice(0, wideFrom) + open + merged + close + text.slice(wideTo),
      range: { from: wideFrom + open.length, to: wideFrom + open.length + merged.length },
    };
  }
  return {
    text: text.slice(0, start) + open + inner + close + text.slice(end),
    range: { from: start + open.length, to: start + open.length + inner.length },
  };
}

// Parejas de una marca en la línea de la selección, fuera del código en línea.
function markSpans(text: string, from: number, to: number, open: string, close: string) {
  const lineFrom = lineStart(text, from);
  const lineEnd = text.indexOf("\n", to);
  const line = text.slice(lineFrom, lineEnd === -1 ? text.length : lineEnd);
  const code = [...line.matchAll(/`[^`]*`/g)].map((match) => [
    match.index,
    match.index + match[0].length,
  ]);
  const inCode = (index: number) => code.some(([a = 0, b = 0]) => index >= a && index < b);
  const marks: { at: number; length: number }[] = [];
  if (open.startsWith("*")) {
    for (const match of line.matchAll(/\*+/g)) {
      const size = match[0].length;
      if (!inCode(match.index) && (open.length === 1 ? size % 2 === 1 : size >= 2)) {
        marks.push({ at: match.index, length: size });
      }
    }
  } else {
    for (let at = 0; at < line.length; at++) {
      const expectOpen = marks.length % 2 === 0;
      const mark = expectOpen ? open : close;
      if (!inCode(at) && line.startsWith(mark, at)) {
        marks.push({ at, length: mark.length });
        at += mark.length - 1;
      }
    }
  }
  const spans: TextRange[] = [];
  for (let index = 0; index + 1 < marks.length; index += 2) {
    const first = marks[index];
    const last = marks[index + 1];
    if (first && last) {
      spans.push({ from: lineFrom + first.at, to: lineFrom + last.at + last.length });
    }
  }
  return spans;
}

// Al ampliar una marca, las mismas marcas de dentro sobran: «**hola** mundo» → «**hola mundo**».
// El código en línea no se toca.
function withoutMark(inner: string, open: string, close: string): string {
  const parts = inner.split(/(`[^`]*`)/);
  const plain = parts.filter((_, index) => index % 2 === 0).join("");
  if (open.startsWith("*")) {
    const size = open.length;
    const runs = plain.match(/\*+/g) ?? [];
    const hits = runs.filter((stars) =>
      size === 1 ? stars.length % 2 === 1 : stars.length >= 2,
    ).length;
    if (hits === 0 || hits % 2 === 1) return inner;
    return parts
      .map((part, index) =>
        index % 2 === 1
          ? part
          : part.replace(/\*+/g, (stars) =>
              (size === 1 ? stars.length % 2 === 1 : stars.length >= 2)
                ? "*".repeat(stars.length - size)
                : stars,
            ),
      )
      .join("");
  }
  const count = (mark: string) => plain.split(mark).length - 1;
  if (count(open) === 0 || count(open) !== count(close)) return inner;
  return parts
    .map((part, index) =>
      index % 2 === 1 ? part : part.split(open).join("").split(close).join(""),
    )
    .join("");
}

// Las marcas en línea no cruzan líneas: se aplican al contenido de cada una y se conservan los
// prefijos de lista, tarea, cita o encabezado, y las líneas vacías.
function toggleLines(
  text: string,
  { from, to }: TextRange,
  open: string,
  close: string,
): MarkdownEdit {
  let fenced = false;
  const lines = text
    .slice(from, to)
    .split("\n")
    .map((line) => {
      // Bloques de código, tablas y separadores se dejan intactos.
      const fence = /^[ \t]*(```|~~~)/.test(line);
      if (fence) fenced = !fenced;
      if (fence || fenced || isStructural(line)) {
        return { head: line, body: "" };
      }
      const head = line.match(prefix)?.[0] ?? "";
      return { head, body: line.slice(head.length) };
    });
  const toggle = (body: string) =>
    toggleInline(body, { from: 0, to: body.length }, open, close).text;
  const isWrapped = (body: string) => toggle(body).length < body.length;
  const filled = lines.filter((line) => line.body.trim());
  const unwrap = filled.every((line) => isWrapped(line.body));
  const result = lines
    .map(({ head, body }) =>
      body.trim() && isWrapped(body) === unwrap ? head + toggle(body) : head + body,
    )
    .join("\n");
  return {
    text: text.slice(0, from) + result + text.slice(to),
    range: { from, to: from + result.length },
  };
}

// Dentro de un código en línea (o cruzándolo) no se puede marcar sin romperlo.
function cutsCode(text: string, from: number, to: number): boolean {
  const lineFrom = lineStart(text, from);
  const lineEnd = text.indexOf("\n", to);
  const line = text.slice(lineFrom, lineEnd === -1 ? text.length : lineEnd);
  return [...line.matchAll(/(`+)[^`]+?\1/g)].some((match) => {
    const spanFrom = lineFrom + match.index;
    const spanTo = spanFrom + match[0].length;
    return spanFrom < to && spanTo > from && !(spanFrom >= from && spanTo <= to);
  });
}

function longestTicks(value: string): number {
  return Math.max(0, ...(value.match(/`+/g) ?? []).map((ticks) => ticks.length));
}

// Código en línea con un delimitador más largo que cualquier serie de «`» del contenido.
function toggleCode(text: string, { from, to }: TextRange): MarkdownEdit {
  const selected = text.slice(from, to);
  const outer = selected.match(/^(`+)( ?)([\s\S]*?)\2\1$/);
  if (outer?.[1] && outer[3] !== undefined && longestTicks(outer[3]) < outer[1].length) {
    return {
      text: text.slice(0, from) + outer[3] + text.slice(to),
      range: { from, to: from + outer[3].length },
    };
  }
  const before = text.slice(0, from).match(/(`+)( ?)$/);
  const after = text.slice(to).match(/^( ?)(`+)/);
  if (
    before?.[1] &&
    after?.[2] &&
    before[1].length === after[2].length &&
    before[2] === after[1] &&
    longestTicks(selected) < before[1].length
  ) {
    const start = from - before[0].length;
    return {
      text: text.slice(0, start) + selected + text.slice(to + after[0].length),
      range: { from: start, to: start + selected.length },
    };
  }
  if (cutsCode(text, from, to)) return { text, range: { from, to } };
  const start = selected.trim() ? from + selected.length - selected.trimStart().length : from;
  const end = selected.trim() ? to - (selected.length - selected.trimEnd().length) : to;
  const inner = text.slice(start, end);
  const ticks = "`".repeat(longestTicks(inner) + 1);
  const pad = inner.startsWith("`") || inner.endsWith("`") ? " " : "";
  const open = ticks + pad;
  return {
    text: text.slice(0, start) + open + inner + pad + ticks + text.slice(end),
    range: { from: start + open.length, to: end + open.length },
  };
}

export function insertLink(text: string, { from, to }: TextRange): MarkdownEdit {
  const prefix = `[${text.slice(from, to)}](`;
  return {
    text: `${text.slice(0, from)}${prefix}url)${text.slice(to)}`,
    range: { from: from + prefix.length, to: from + prefix.length + 3 },
  };
}
