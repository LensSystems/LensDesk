import mammoth from "mammoth";
import { convertHtml } from "./html.ts";

export async function convertDocx(bytes: Uint8Array) {
  const result = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
  const converted = convertHtml(result.value);
  return {
    ...converted,
    warnings: result.messages.map((message) => message.message),
  };
}
