import type { z } from "zod";
import type { ReturnDetail, returnDetailParamsSchema } from "../shared/history-contracts.ts";
import type { Db } from "./db/driver.ts";
import { DomainFault } from "./domain.ts";
import { historical } from "./historical-metadata.ts";
import { revision } from "./history-queries.ts";
export function returnDetailData(
  db: Db,
  p: z.infer<typeof returnDetailParamsSchema>,
): ReturnDetail {
  const current = revision(db, p.revision);
  const row = db.get<
    Omit<ReturnDetail["record"], "restock" | "bankSnapshot"> & {
      restock: number;
      bankSnapshot: string;
      saleFolio: number;
    }
  >(
    "SELECT r.*,s.folio AS saleFolio FROM returns r JOIN sales s ON s.id=r.saleId WHERE r.id=?",
    p.returnId,
  );
  if (!row) throw new DomainFault("E_NOT_FOUND");
  const { saleFolio, bankSnapshot, restock, ...record } = row;
  const total =
    db.get<{ n: number }>("SELECT COUNT(*) AS n FROM return_lines WHERE returnId=?", p.returnId)
      ?.n ?? 0;
  const rows = db.all<ReturnDetail["lines"]["rows"][number]>(
    `SELECT l.*,json_extract(j.value,'$.name') AS name,json_extract(j.value,'$.price') AS price
     FROM return_lines l JOIN returns r ON r.id=l.returnId JOIN sales s ON s.id=r.saleId
     JOIN json_each(s.lines) j ON json_extract(j.value,'$.id')=l.lineId
     WHERE l.returnId=? ORDER BY l.lineId,l.id LIMIT ? OFFSET ?`,
    p.returnId,
    p.limit,
    p.offset,
  );
  return {
    revision: current,
    record: {
      ...record,
      ...historical(db, "returns", p.returnId),
      restock: Boolean(restock),
      bankSnapshot: JSON.parse(bankSnapshot),
    },
    saleFolio,
    ...(historical(db, "sales", record.saleId).legacyFolio
      ? { saleLegacyFolio: historical(db, "sales", record.saleId).legacyFolio }
      : {}),
    lines: { total, rows, nextOffset: p.offset + p.limit < total ? p.offset + p.limit : null },
  };
}
