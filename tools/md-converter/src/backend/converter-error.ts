import { LensError } from "@lensdesk/sdk/errors";

export type ToolErrorCode = "E_UNSUPPORTED_FORMAT" | "E_PDF_NO_TEXT";

export class ConverterError extends LensError {
  constructor(code: ToolErrorCode, message: string) {
    super("E_INTERNAL", message);
    Object.defineProperty(this, "code", { value: code, enumerable: true });
  }
}
