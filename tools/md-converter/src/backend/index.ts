import type { BackendContext } from "@lensdesk/sdk/backend";
import { type BackendMethod, defineBackend } from "@lensdesk/sdk/backend";
import { LensError } from "@lensdesk/sdk/errors";
import { convertCsv } from "./csv.ts";
import { convertDocx } from "./docx.ts";
import { convertHtml } from "./html.ts";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const SUPPORTED = new Set(["html", "htm", "docx", "csv"]);
type ToolErrorCode = "E_UNSUPPORTED_FORMAT";

class ConverterError extends LensError {
  constructor(code: ToolErrorCode, message: string) {
    super("E_INTERNAL", message);
    Object.defineProperty(this, "code", { value: code, enumerable: true });
  }
}

type ConvertParams = { token: string; name: string };
type ConverterOptions = { maxBytes?: number };

export function createConvertMethod({ maxBytes = MAX_FILE_BYTES }: ConverterOptions = {}) {
  return async (params: unknown, ctx: BackendContext) => {
    if (
      typeof params !== "object" ||
      params === null ||
      typeof (params as Partial<ConvertParams>).token !== "string" ||
      typeof (params as Partial<ConvertParams>).name !== "string"
    ) {
      throw new LensError("E_INVALID_PARAMS", "Se requieren token y nombre de archivo");
    }
    const { token, name } = params as ConvertParams;
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
    } else {
      throw new ConverterError("E_UNSUPPORTED_FORMAT", "Formato de archivo no compatible");
    }
    const warnings: string[] = [];
    if (imageCount > 0) {
      const note =
        imageCount === 1 ? "Se omitió 1 imagen." : `Se omitieron ${imageCount} imágenes.`;
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
