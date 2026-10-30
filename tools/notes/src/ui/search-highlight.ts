export type SearchSpan = { text: string; match: boolean };

const combiningMarks = /\p{M}/gu;
const asciiText = /^\p{ASCII}*$/u;

function fold(text: string): string {
  return text.normalize("NFD").replace(combiningMarks, "").toLowerCase();
}

export function searchHighlight(text: string, query: string): SearchSpan[] {
  // Como el tokenizador de la búsqueda: los signos separan términos y no cuentan.
  const terms = fold(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!terms.length) return [{ text, match: false }];
  const directOffsets = asciiText.test(text);
  let normalized = directOffsets ? text.toLowerCase() : "";
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  if (!directOffsets) {
    for (const character of text) {
      const value = character.charCodeAt(0) <= 0x7f ? character.toLowerCase() : fold(character);
      if (!value && ends.length) ends[ends.length - 1] = offset + character.length;
      for (let i = 0; i < value.length; i++) {
        starts.push(offset);
        ends.push(offset + character.length);
      }
      normalized += value;
      offset += character.length;
    }
  }
  const ranges: { start: number; end: number }[] = [];
  for (const word of normalized.matchAll(/[\p{L}\p{N}]+/gu)) {
    for (const term of terms) {
      if (!word[0].startsWith(term)) continue;
      const start = directOffsets ? word.index : starts[word.index];
      // Se marca la palabra entera: un prefijo marcado a medias parte la palabra a la vista.
      const end = directOffsets
        ? word.index + word[0].length
        : ends[word.index + word[0].length - 1];
      if (start !== undefined && end !== undefined) ranges.push({ start, end });
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  const spans: SearchSpan[] = [];
  let cursor = 0;
  for (const { start, end } of merged) {
    if (start > cursor) spans.push({ text: text.slice(cursor, start), match: false });
    spans.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) spans.push({ text: text.slice(cursor), match: false });
  return spans.length ? spans : [{ text, match: false }];
}
