import { readFile } from "node:fs/promises";
import { createTestContext } from "@lensdesk/sdk/backend/testing";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createConvertMethod } from "../src/backend/index.ts";
import { makeDocx } from "./make-docx.ts";
import { makePdf } from "./make-pdf.ts";

const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url));

async function convert(name: string, bytes: Uint8Array, locale?: string) {
  const ctx = createTestContext({ dataDir: "/tmp/md-converter-test" });
  ctx.fileBytes.set("file-token", bytes);
  return createConvertMethod()({ token: "file-token", name, ...(locale ? { locale } : {}) }, ctx);
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

  it("escribe la nota de imágenes omitidas en inglés cuando se pide", async () => {
    const one = (await convert("uno.html", new TextEncoder().encode("<p>a</p><img>"), "en")) as {
      markdown: string;
      warnings: string[];
    };
    expect(one.markdown).toContain("1 image was omitted.");
    expect(one.warnings).toEqual(["1 image was omitted."]);
    const many = (await convert(
      "dos.html",
      new TextEncoder().encode("<p>a</p><img><img><img>"),
      "en",
    )) as { markdown: string; warnings: string[] };
    expect(many.warnings).toEqual(["3 images were omitted."]);
    const spanish = (await convert("es.html", new TextEncoder().encode("<img><img>"), "es")) as {
      warnings: string[];
    };
    expect(spanish.warnings).toEqual(["Se omitieron 2 imágenes."]);
    const ctx = createTestContext({ dataDir: "/tmp/md-converter-test" });
    ctx.fileBytes.set("file-token", new TextEncoder().encode("<img>"));
    await expect(
      createConvertMethod()({ token: "file-token", name: "x.html", locale: "fr" }, ctx),
    ).rejects.toMatchObject({ code: "E_INVALID_PARAMS", message: "Parámetros no válidos" });
    await expect(
      createConvertMethod()({ token: "file-token", name: "x.html", extra: 1 }, ctx),
    ).rejects.toMatchObject({ code: "E_INVALID_PARAMS" });
  });

  it("convierte PDF por páginas y rechaza los que no tienen texto", async () => {
    const result = (await convert("informe.pdf", makePdf())) as { markdown: string };
    expect(result.markdown).toContain("Primer parrafo");
    expect(result.markdown).toContain("Segundo parrafo");
    expect(result.markdown).toMatch(/Primer parrafo[\s\S]*\n---\n[\s\S]*Segundo parrafo/);
    const ctx = createTestContext({ dataDir: "/tmp/md-converter-test" });
    ctx.fileBytes.set("file-token", makePdf(false));
    await expect(
      createConvertMethod()({ token: "file-token", name: "vacio.pdf" }, ctx),
    ).rejects.toMatchObject({ code: "E_PDF_NO_TEXT" });
  });

  it("convierte cada hoja XLSX en una tabla GFM", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Nombre", "Edad"],
        ["Ada", 36],
      ]),
      "Personas",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Ciudad", "País"],
        ["Lima", "Perú"],
      ]),
      "Lugares",
    );
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const ctx = createTestContext({ dataDir: "/tmp/md-converter-test" });
    ctx.fileBytes.set("file-token", new Uint8Array(bytes));
    const result = (await createConvertMethod()(
      { token: "file-token", name: "datos.xlsx" },
      ctx,
    )) as {
      markdown: string;
    };
    expect(result.markdown).toContain("## Personas\n\n| Nombre | Edad |");
    expect(result.markdown).toContain("| Ada | 36 |");
    expect(result.markdown).toContain("## Lugares\n\n| Ciudad | País |");
    expect(result.markdown).toContain("| Lima | Perú |");
    expect(ctx.progressEvents.length).toBeGreaterThan(0);
  });

  it("cancela una conversión en curso en menos de un segundo", async () => {
    const ctx = createTestContext({ dataDir: "/tmp/md-converter-test" });
    ctx.fileBytes.set("file-token", makePdf());
    const controller = new AbortController();
    Object.defineProperty(ctx, "signal", { value: controller.signal });
    const progress = ctx.progress;
    ctx.progress = (fraction, message) => {
      progress(fraction, message);
      controller.abort();
    };
    const started = performance.now();
    await expect(
      createConvertMethod()({ token: "file-token", name: "informe.pdf" }, ctx),
    ).rejects.toMatchObject({ code: "E_CANCELLED" });
    expect(performance.now() - started).toBeLessThan(1000);
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
