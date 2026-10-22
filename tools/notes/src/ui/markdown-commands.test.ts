import { describe, expect, it } from "vitest";
import { insertLink, marks, toggleMarks } from "./markdown-commands.ts";

describe("formato Markdown", () => {
  it.each(Object.values(marks))("envuelve y alterna %s", (open, close) => {
    const wrapped = toggleMarks("hola", { from: 0, to: 4 }, open, close);
    expect(wrapped).toEqual({
      text: `${open}hola${close}`,
      range: { from: open.length, to: open.length + 4 },
    });
    expect(toggleMarks(wrapped.text, wrapped.range, open, close)).toEqual({
      text: "hola",
      range: { from: 0, to: 4 },
    });
    expect(toggleMarks(wrapped.text, { from: 0, to: wrapped.text.length }, open, close)).toEqual({
      text: "hola",
      range: { from: 0, to: 4 },
    });
  });
  it("distingue cursiva de negrita al alternar", () => {
    expect(toggleMarks("**hola**", { from: 2, to: 6 }, "*").text).toBe("***hola***");
    expect(toggleMarks("**hola**", { from: 0, to: 8 }, "*").text).toBe("***hola***");
    expect(toggleMarks("***hola***", { from: 3, to: 7 }, "*").text).toBe("**hola**");
    expect(toggleMarks("***hola***", { from: 3, to: 7 }, "**").text).toBe("*hola*");
    expect(toggleMarks("*hola*", { from: 1, to: 5 }, "**").text).toBe("***hola***");
    expect(toggleMarks("***hola***", { from: 0, to: 10 }, "*").text).toBe("**hola**");
  });

  it("une en una sola marca los fragmentos ya marcados", () => {
    const bold = "**uno** y **dos**";
    expect(toggleMarks(bold, { from: 0, to: bold.length }, "**").text).toBe("**uno y dos**");
    expect(toggleMarks(bold, { from: 2, to: bold.length - 2 }, "**").text).toBe("**uno y dos**");
    const code = "`uno` y `dos`";
    expect(toggleMarks(code, { from: 0, to: code.length }, "`").text).toBe(`\`\` ${code} \`\``);
    const under = "<u>uno</u> y <u>dos</u>";
    expect(toggleMarks(under, { from: 0, to: under.length }, "<u>", "</u>").text).toBe(
      "<u>uno y dos</u>",
    );
  });

  it("quita la marca exterior con la otra anidada dentro", () => {
    const italic = "*uno **dos** tres*";
    expect(toggleMarks(italic, { from: 0, to: italic.length }, "*").text).toBe("uno **dos** tres");
    expect(toggleMarks(italic, { from: 1, to: italic.length - 1 }, "*").text).toBe(
      "uno **dos** tres",
    );
    const bold = "**uno *dos* tres**";
    expect(toggleMarks(bold, { from: 0, to: bold.length }, "**").text).toBe("uno *dos* tres");
    expect(toggleMarks(bold, { from: 2, to: bold.length - 2 }, "**").text).toBe("uno *dos* tres");
    const split = "*uno* y *dos*";
    expect(toggleMarks(split, { from: 0, to: split.length }, "*").text).toBe("*uno y dos*");
  });

  it("ignora asteriscos de código en línea y escapados", () => {
    for (const inner of ["`a*b`", "a\\*b"]) {
      const wrapped = toggleMarks(inner, { from: 0, to: inner.length }, "**");
      expect(wrapped.text).toBe(`**${inner}**`);
      expect(toggleMarks(wrapped.text, { from: 0, to: wrapped.text.length }, "**").text).toBe(
        inner,
      );
      expect(toggleMarks(wrapped.text, wrapped.range, "**").text).toBe(inner);
    }
  });

  it("deja fuera los espacios de los extremos al envolver", () => {
    expect(toggleMarks("hola mundo", { from: 0, to: 5 }, "**")).toEqual({
      text: "**hola** mundo",
      range: { from: 2, to: 6 },
    });
    expect(toggleMarks("di  hola", { from: 2, to: 8 }, "*").text).toBe("di  *hola*");
  });

  it("código en línea con «`» dentro usa un delimitador más largo", () => {
    const source = "const saludo = `hola`;";
    const wrapped = toggleMarks(source, { from: 0, to: source.length }, "`");
    expect(wrapped.text).toBe("``const saludo = `hola`;``");
    expect(toggleMarks(wrapped.text, wrapped.range, "`").text).toBe(source);
    expect(toggleMarks(wrapped.text, { from: 0, to: wrapped.text.length }, "`").text).toBe(source);
    const edge = toggleMarks("`a` b", { from: 0, to: 5 }, "`");
    expect(edge.text).toBe("`` `a` b ``");
    expect(toggleMarks(edge.text, edge.range, "`").text).toBe("`a` b");
    expect(toggleMarks("`a`", { from: 0, to: 3 }, "`").text).toBe("a");
  });

  it("aplica y quita la marca en cada párrafo", () => {
    const wrapped = toggleMarks("uno\n\ndos", { from: 0, to: 8 }, "**");
    expect(wrapped.text).toBe("**uno**\n\n**dos**");
    expect(toggleMarks(wrapped.text, wrapped.range, "**").text).toBe("uno\n\ndos");
    expect(toggleMarks("**uno**\n\ndos", { from: 0, to: 12 }, "**").text).toBe(
      "**uno**\n\n**dos**",
    );
    const code = toggleMarks("uno\n\ndos", { from: 0, to: 8 }, "`");
    expect(code.text).toBe("`uno`\n\n`dos`");
    expect(toggleMarks(code.text, code.range, "`").text).toBe("uno\n\ndos");
  });

  it("conserva listas, tareas y citas al aplicar la marca por línea", () => {
    const list = "- uno\n- dos\n1. tres\n- [ ] cuatro\n> cinco";
    const wrapped = toggleMarks(list, { from: 0, to: list.length }, "**");
    expect(wrapped.text).toBe("- **uno**\n- **dos**\n1. **tres**\n- [ ] **cuatro**\n> **cinco**");
    expect(toggleMarks(wrapped.text, wrapped.range, "**").text).toBe(list);
    expect(toggleMarks("uno\ndos", { from: 0, to: 7 }, "*").text).toBe("*uno*\n*dos*");
    expect(toggleMarks("- uno\n", { from: 0, to: 6 }, "**").text).toBe("- **uno**\n");
    expect(toggleMarks("- uno", { from: 0, to: 5 }, "**").text).toBe("- **uno**");
    expect(toggleMarks("# Título", { from: 0, to: 8 }, "**").text).toBe("# **Título**");
    expect(toggleMarks("- **uno**", { from: 0, to: 9 }, "**").text).toBe("- uno");
    expect(toggleMarks("---", { from: 0, to: 3 }, "**").text).toBe("---");
    const table = "Nombre | Valor\n--- | ---\nuno | dos\n\nfin";
    expect(toggleMarks(table, { from: 0, to: table.length }, "**").text).toBe(
      "Nombre | Valor\n--- | ---\nuno | dos\n\n**fin**",
    );
    const note = "uno\n```ts\nconst a = 1;\n```\n| a | b |\n---\ndos";
    expect(toggleMarks(note, { from: 0, to: note.length }, "**").text).toBe(
      "**uno**\n```ts\nconst a = 1;\n```\n| a | b |\n---\n**dos**",
    );
  });

  it("absorbe las mismas marcas al ampliarlas a toda la selección", () => {
    expect(toggleMarks("**hola** mundo", { from: 0, to: 14 }, "**").text).toBe("**hola mundo**");
    expect(toggleMarks("*hola* mundo", { from: 0, to: 12 }, "*").text).toBe("*hola mundo*");
    expect(toggleMarks("~~a~~ b", { from: 0, to: 7 }, "~~").text).toBe("~~a b~~");
    expect(toggleMarks("**hola** mundo", { from: 2, to: 14 }, "**").text).toBe("**hola mundo**");
    expect(toggleMarks("mundo **hola**", { from: 0, to: 12 }, "**").text).toBe("**mundo hola**");
    expect(toggleMarks("*hola* mundo", { from: 1, to: 12 }, "*").text).toBe("*hola mundo*");
    const inside = "**hola bonita** mundo";
    expect(toggleMarks(inside, { from: 7, to: inside.length }, "**").text).toBe(
      "**hola bonita mundo**",
    );
    const left = "mundo **hola bonita**";
    expect(toggleMarks(left, { from: 0, to: 12 }, "**").text).toBe("**mundo hola bonita**");
    const tilde = "~~hola bonita~~ mundo";
    expect(toggleMarks(tilde, { from: 7, to: tilde.length }, "~~").text).toBe(
      "~~hola bonita mundo~~",
    );
    expect(toggleMarks("**a** `**` b", { from: 0, to: 12 }, "**").text).toBe("**a `**` b**");
    expect(toggleMarks("**hola** mundo", { from: 0, to: 14 }, "*").text).toBe("***hola** mundo*");
  });

  it("quita la marca solo a la parte seleccionada de dentro", () => {
    expect(toggleMarks("**hola bonita mundo**", { from: 7, to: 13 }, "**").text).toBe(
      "**hola** bonita **mundo**",
    );
    expect(toggleMarks("**hola bonita**", { from: 7, to: 13 }, "**").text).toBe("**hola** bonita");
    expect(toggleMarks("*hola bonita*", { from: 1, to: 5 }, "*").text).toBe("hola *bonita*");
    const nested = "**hola *bonita mundo* fin**";
    expect(toggleMarks(nested, { from: 8, to: 14 }, "**").text).toBe(nested);
  });

  it("no rompe un código en línea al seleccionar parte de él", () => {
    expect(toggleMarks("`hola mundo`", { from: 1, to: 5 }, "`").text).toBe("`hola mundo`");
    expect(toggleMarks("a `b c` d", { from: 0, to: 4 }, "`").text).toBe("a `b c` d");
    expect(toggleMarks("`a` b", { from: 4, to: 5 }, "`").text).toBe("`a` `b`");
    expect(toggleMarks("`a b c`", { from: 3, to: 4 }, "**").text).toBe("`a b c`");
    expect(toggleMarks("x `a` y", { from: 0, to: 7 }, "**").text).toBe("**x `a` y**");
    const multi = "Usa `archivo local`\ny continúa";
    expect(toggleMarks(multi, { from: 13, to: multi.length }, "**").text).toBe(
      "**Usa `archivo local`**\n**y continúa**",
    );
    expect(toggleMarks("uno\na `b c` d", { from: 0, to: 8 }, "**").text).toBe(
      "**uno**\n**a `b c` d**",
    );
    const bold = "**hola mundo**\notra";
    expect(toggleMarks(bold, { from: 7, to: bold.length }, "**").text).toBe(
      "**hola mundo**\n**otra**",
    );
    const back = "otra\n**hola mundo**";
    expect(toggleMarks(back, { from: 0, to: 12 }, "**").text).toBe("**otra**\n**hola mundo**");
  });

  it("inserta marcas sin selección y sitúa el cursor dentro", () => {
    expect(toggleMarks("ab", { from: 1, to: 1 }, "**")).toEqual({
      text: "a****b",
      range: { from: 3, to: 3 },
    });
  });
  it("con varias líneas envuelve cada línea completa", () => {
    expect(toggleMarks("xuno\ndosy\nfin", { from: 1, to: 8 }, "~~")).toEqual({
      text: "~~xuno~~\n~~dosy~~\nfin",
      range: { from: 0, to: 17 },
    });
  });
  it.each([
    { from: 0, to: 4 },
    { from: 2, to: 2 },
  ])("inserta enlace y selecciona url: %s", (range) => {
    const edit = insertLink("hola", range);
    expect(edit.text).toBe(range.from === 0 ? "[hola](url)" : "ho[](url)la");
    expect(edit.text.slice(edit.range.from, edit.range.to)).toBe("url");
  });
});
