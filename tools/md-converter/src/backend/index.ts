import type { BackendContext } from "@lensdesk/sdk/backend";
import { type BackendMethod, defineBackend } from "@lensdesk/sdk/backend";
import { LensError } from "@lensdesk/sdk/errors";
import { ConverterError } from "./converter-error.ts";
import { convertCsv } from "./csv.ts";
import { convertDocx } from "./docx.ts";
import { convertHtml } from "./html.ts";
import { convertPdf } from "./pdf.ts";
import { convertXlsx } from "./xlsx.ts";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const SUPPORTED = new Set(["html", "htm", "docx", "csv", "pdf", "xlsx"]);
type ConvertParams = { token: string; name: string; locale: "es" | "en" };
type ConverterOptions = { maxBytes?: number };

// Sin zod en el bundle de la herramienta: la validación del borde se escribe a mano.
function parseConvertParams(params: unknown): ConvertParams | null {
  if (typeof params !== "object" || params === null) return null;
  const value = params as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["token", "name", "locale"].includes(key))) return null;
  const { token, name, locale = "es" } = value;
  if (typeof token !== "string" || typeof name !== "string") return null;
  if (locale !== "es" && locale !== "en") return null;
  return { token, name, locale };
}

function omittedImagesNote(count: number, locale: "es" | "en"): string {
  if (locale === "en")
    return count === 1 ? "1 image was omitted." : `${count} images were omitted.`;
  return count === 1 ? "Se omitió 1 imagen." : `Se omitieron ${count} imágenes.`;
}

export function createConvertMethod({ maxBytes = MAX_FILE_BYTES }: ConverterOptions = {}) {
  return async (params: unknown, ctx: BackendContext) => {
    const parsed = parseConvertParams(params);
    if (!parsed) throw new LensError("E_INVALID_PARAMS", "Parámetros no válidos");
    const { token, name, locale } = parsed;
    const extension = name.toLowerCase().match(/\.([^.]+)$/)?.[1];
    // Un formato no compatible se rechaza antes de leer el archivo.
    if (!extension || !SUPPORTED.has(extension))
      throw new ConverterError("E_UNSUPPORTED_FORMAT", "Formato de archivo no compatible");
    const bytes = await ctx.files.readBytes(token);
    if (bytes.byteLength > maxBytes) throw new LensError("E_TOO_LARGE", "El archivo supera 50 MB");
    let markdown: string;
    let imageCount = 0;
    if (extension === "html" || extension === "htm") {
      const result = convertHtml(new TextDecoder().decode(bytes));
      markdown = result.markdown;
      imageCount = result.imageCount;
    } else if (extension === "docx") {
      const result = await convertDocx(bytes);
      markdown = result.markdown;
      imageCount = result.imageCount;
    } else if (extension === "csv") {
      markdown = convertCsv(bytes);
    } else if (extension === "pdf") {
      markdown = await convertPdf(bytes, ctx);
    } else if (extension === "xlsx") {
      markdown = await convertXlsx(bytes, ctx);
    } else {
      throw new ConverterError("E_UNSUPPORTED_FORMAT", "Formato de archivo no compatible");
    }
    ctx.progress(1, `Archivo convertido: ${name}`);
    const warnings: string[] = [];
    if (imageCount > 0) {
      const note = omittedImagesNote(imageCount, locale);
      markdown = `${markdown}${markdown ? "\n\n" : ""}${note}`;
      warnings.push(note);
    }
    return { markdown, warnings };
  };
}

export const methods = {
  convert: createConvertMethod(),
} satisfies Record<string, BackendMethod>;

defineBackend({ methods });
