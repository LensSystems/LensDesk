import Papa from "papaparse";
import { toGfmTable } from "./gfm-table.ts";

export function convertCsv(bytes: Uint8Array): string {
  const parsed = Papa.parse<string[]>(new TextDecoder().decode(bytes), {
    skipEmptyLines: true,
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0]?.message ?? "CSV inválido");
  return toGfmTable(parsed.data).trim();
}
