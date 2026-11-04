import { describe, expect, it } from "vitest";
import { searchHighlight } from "./search-highlight.ts";

describe("resaltado de búsqueda", () => {
  it.each([
    ["Sprint", "sprint", ["Sprint"]],
    ["Café", "cafe", ["Café"]],
    ["cafe", "café", ["cafe"]],
    ["café", "CAF", ["café"]],
    ["Sprint", "spr", ["Sprint"]],
    ["desprint", "spr", []],
    ["Sprint y Café 123", "spr cafe 12", ["Sprint", "Café", "123"]],
    ["Sprint", "spr sprint spr", ["Sprint"]],
    ["Cafe\u0301", "café", ["Cafe\u0301"]],
    ["각", "ᄀ", ["각"]],
    ["𐐀123", "𐐨1", ["𐐀123"]],
    ["ASCII 123!", "asc 12", ["ASCII", "123"]],
    ["İstanbul y AİḾO", "i aimo", ["İstanbul", "AİḾO"]],
    ["Cafe\u0301\u0327 noir", "cafe", ["Cafe\u0301\u0327"]],
    ["\u0301Cafe\u0301", "caf", ["Cafe\u0301"]],
    ["𐐀cafe\u0301 👩🏽‍💻 Café", "𐐨ca cafe", ["𐐀cafe\u0301", "Café"]],
    ["각 각a", "가", ["각", "각a"]],
    ["Sprint", "", []],
    ["Sprint", "  \t ", []],
    ["Sprint", '"spr"', ["Sprint"]],
    ["plan-sprint", "plan-spr", ["plan", "sprint"]],
    ["Sprint", "<img src=x onerror=alert(1)>", []],
  ])("%s con %s conserva el texto y marca las palabras", (text, query, expected) => {
    const spans = searchHighlight(text, query);
    expect(spans.filter((span) => span.match).map((span) => span.text)).toEqual(expected);
    expect(spans.map((span) => span.text).join("")).toBe(text);
    if (!query.trim()) expect(spans).toEqual([{ text, match: false }]);
  });

  it("une rangos que se tocan al expandir un carácter", () => {
    expect(searchHighlight("각", "ᄀ 가")).toEqual([{ text: "각", match: true }]);
  });

  it("preserva los tramos sin coincidencia", () => {
    expect(searchHighlight("Ideas Sprint final", "spr")).toEqual([
      { text: "Ideas ", match: false },
      { text: "Sprint", match: true },
      { text: " final", match: false },
    ]);
  });

  it("preserva los límites UTF-16 al alternar caracteres ASCII y Unicode", () => {
    expect(searchHighlight("👩🏽‍💻 Cafe\u0301 y 𐐀123!", "café 𐐨1")).toEqual([
      { text: "👩🏽‍💻 ", match: false },
      { text: "Cafe\u0301", match: true },
      { text: " y ", match: false },
      { text: "𐐀123", match: true },
      { text: "!", match: false },
    ]);
  });

  it("no conserva estado de las marcas entre consultas repetidas", () => {
    for (let i = 0; i < 20; i++) {
      expect(searchHighlight("Café Cafe\u0301", "CAFÉ")).toEqual([
        { text: "Café", match: true },
        { text: " ", match: false },
        { text: "Cafe\u0301", match: true },
      ]);
    }
  });
});
