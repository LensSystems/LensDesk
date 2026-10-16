import type { BackendContext } from "@lensdesk/sdk/backend";
import { LensError } from "@lensdesk/sdk/errors";
import * as XLSX from "xlsx";
import { toGfmTable } from "./gfm-table.ts";

const ROW_BLOCK_SIZE = 500;

export async function convertXlsx(bytes: Uint8Array, ctx: BackendContext): Promise<string> {
  if (ctx.signal.aborted) throw new LensError("E_CANCELLED", "Conversión cancelada");
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheets: string[] = [];
  let completedBlocks = 0;
  const blockCounts = workbook.SheetNames.reduce((total, name) => {
    const range = workbook.Sheets[name]?.["!ref"];
    if (!range) return total;
    const bounds = XLSX.utils.decode_range(range);
    return total + Math.max(1, Math.ceil((bounds.e.r - bounds.s.r + 1) / ROW_BLOCK_SIZE));
  }, 0);

  for (const name of workbook.SheetNames) {
    if (ctx.signal.aborted) throw new LensError("E_CANCELLED", "Conversión cancelada");
    const sheet = workbook.Sheets[name];
    const reference = sheet?.["!ref"];
    if (!sheet || !reference) {
      sheets.push(`## ${name}\n\n`);
      continue;
    }
    const bounds = XLSX.utils.decode_range(reference);
    const markdown: string[] = [];
    for (let start = bounds.s.r; start <= bounds.e.r; start += ROW_BLOCK_SIZE) {
      if (ctx.signal.aborted) throw new LensError("E_CANCELLED", "Conversión cancelada");
      const blockEnd = Math.min(start + ROW_BLOCK_SIZE - 1, bounds.e.r);
      const block = XLSX.utils
        .sheet_to_json<unknown[]>(sheet, {
          header: 1,
          raw: false,
          range: { s: { r: start, c: bounds.s.c }, e: { r: blockEnd, c: bounds.e.c } },
        })
        .map((row) => row.map((cell) => String(cell ?? "")));
      const table = toGfmTable(block);
      if (start === bounds.s.r) markdown.push(table);
      else markdown.push(...table.split("\n").slice(2));
      completedBlocks += 1;
      ctx.progress(blockCounts ? completedBlocks / blockCounts : 1, `Hoja ${name}`);
    }
    sheets.push(`## ${name}\n\n${markdown.join("\n")}`);
  }
  if (ctx.signal.aborted) throw new LensError("E_CANCELLED", "Conversión cancelada");
  return sheets.join("\n\n").trim();
}
