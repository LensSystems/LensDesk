import type { BackendContext } from "@lensdesk/sdk/backend";
import { LensError } from "@lensdesk/sdk/errors";
import { getDocumentProxy } from "unpdf";
import { ConverterError } from "./converter-error.ts";

export async function convertPdf(bytes: Uint8Array, ctx: BackendContext): Promise<string> {
  if (ctx.signal.aborted) throw new LensError("E_CANCELLED", "Conversión cancelada");
  const document = await getDocumentProxy(bytes);
  // El proceso del backend sigue vivo entre conversiones: libera la memoria de pdf.js siempre.
  try {
    const pages: string[] = [];
    let hasText = false;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (ctx.signal.aborted) throw new LensError("E_CANCELLED", "Conversión cancelada");
      const content = await (await document.getPage(pageNumber)).getTextContent();
      const text = content.items
        .filter((item) => "str" in item)
        .map((item) => `${item.str}${item.hasEOL ? "\n" : ""}`)
        .join("")
        .trim();
      if (text) hasText = true;
      pages.push(toParagraphs(text));
      if (ctx.signal.aborted) throw new LensError("E_CANCELLED", "Conversión cancelada");
      ctx.progress(pageNumber / document.numPages, `Página ${pageNumber} de ${document.numPages}`);
    }
    if (ctx.signal.aborted) throw new LensError("E_CANCELLED", "Conversión cancelada");
    if (!hasText)
      throw new ConverterError("E_PDF_NO_TEXT", "El PDF no contiene texto seleccionable");
    return pages.join("\n\n---\n\n");
  } finally {
    await document.loadingTask.destroy();
  }
}

function toParagraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}
