import { readFile } from "node:fs/promises";
import { createTestContext } from "@lensdesk/sdk/backend/testing";
import { describe, expect, it } from "vitest";
import { createConvertMethod } from "../src/backend/index.ts";
import { makeDocx } from "./make-docx.ts";

const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url));

async function convert(name: string, bytes: Uint8Array) {
  const ctx = createTestContext({ dataDir: "/tmp/md-converter-test" });
  ctx.fileBytes.set("file-token", bytes);
  return createConvertMethod()({ token: "file-token", name }, ctx);
}

describe("backend del convertidor", () => {
  it("convierte HTML a encabezados, código, tabla, tachado y tareas", async () => {
    const result = (await convert("sample.html", await fixture("sample.html"))) as {
      markdown: string;
    };
    expect(result.markdown).toContain("# Documento de prueba");
    expect(result.markdown).toContain("```js");
    expect(result.markdown).toContain("~~tachado~~");
    expect(result.markdown).toContain("- [ ] Pendiente");
    expect(result.markdown).toContain("- [x] Hecha");
    expect(result.markdown.match(/^\|/gm)).toHaveLength(4);
    expect(result.markdown.match(/\|/g)).toHaveLength(12);
  });

  it("tacha también <s> y <strike>, y concuerda la nota de una sola imagen", async () => {
    const html = '<p><s>uno</s> <strike>dos</strike></p><img src="a.png">';
    const result = (await convert("corto.html", new TextEncoder().encode(html))) as {
      markdown: string;
      warnings: string[];
    };
    expect(result.markdown).toContain("~~uno~~ ~~dos~~");
    expect(result.warnings).toEqual(["Se omitió 1 imagen."]);
  });

  it("convierte DOCX con encabezado, negrita y tabla", async () => {
    const result = (await convert("informe.docx", await makeDocx())) as {
      markdown: string;
    };
    expect(result.markdown).toContain("# Informe DOCX");
    expect(result.markdown).toContain("**Texto fuerte**");
    expect(result.markdown).toContain("| Uno | Dos |");
  });

  it("convierte CSV en una tabla GFM y escapa barras verticales", async () => {
    const result = (await convert("datos.csv", await fixture("sample.csv"))) as {
      markdown: string;
    };
    expect(result.markdown.match(/^\|/gm)).toHaveLength(4);
    expect(result.markdown.split("\n")[0]?.match(/(?<!\\)\|/g)).toHaveLength(3);
    expect(result.markdown).toContain("valor \\| uno");
  });

  it("omite imágenes e incluye su conteo en Markdown y warnings", async () => {
    const result = (await convert(
      "imagen.html",
      new TextEncoder().encode("<p>Texto</p><img><img>"),
    )) as {
      markdown: string;
      warnings: string[];
    };
    expect(result.markdown).not.toContain("![");
    expect(result.markdown).toMatch(/2 imágenes/);
    expect(result.warnings[0]).toMatch(/2 imágenes/);
  });

  it("rechaza extensión no compatible y bytes sobre el límite inyectado", async () => {
    const ctx = createTestContext({ dataDir: "/tmp/md-converter-test" });
    ctx.fileBytes.set("file-token", new Uint8Array([1, 2]));
    await expect(
      createConvertMethod()({ token: "file-token", name: "archivo.txt" }, ctx),
    ).rejects.toMatchObject({ code: "E_UNSUPPORTED_FORMAT" });
    await expect(
      createConvertMethod({ maxBytes: 1 })({ token: "file-token", name: "archivo.csv" }, ctx),
    ).rejects.toMatchObject({ code: "E_TOO_LARGE" });
  });
});
