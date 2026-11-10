import { LensError } from "@lensdesk/sdk/errors";
import {
  historyParamsSchema,
  returnDetailParamsSchema,
  saleDetailParamsSchema,
  statementParamsSchema,
  summaryParamsSchema,
} from "../shared/history-contracts.ts";
import type { Db } from "./db/driver.ts";
import { saleDetailData, statementData } from "./detail-queries.ts";
import { checkCancelled, DomainFault } from "./domain.ts";
import { historyData } from "./history-queries.ts";
import { returnDetailData } from "./return-detail-query.ts";
import { summaryData } from "./summary-query.ts";
export type QueryName = "history" | "saleDetail" | "statement" | "summary" | "returnDetail";
export function query(db: Db, name: QueryName, params: unknown, signal: AbortSignal) {
  checkCancelled(signal);
  try {
    return db.transaction(() => {
      let value: unknown;
      switch (name) {
        case "history": {
          const parsed = historyParamsSchema.safeParse(params);
          if (!parsed.success) throw new LensError("E_INVALID_PARAMS", "Invalid history query");
          value = historyData(db, parsed.data);
          break;
        }
        case "returnDetail": {
          const parsed = returnDetailParamsSchema.safeParse(params);
          if (!parsed.success) throw new LensError("E_INVALID_PARAMS", "Invalid return query");
          value = returnDetailData(db, parsed.data);
          break;
        }
        case "saleDetail": {
          const parsed = saleDetailParamsSchema.safeParse(params);
          if (!parsed.success) throw new LensError("E_INVALID_PARAMS", "Invalid sale query");
          value = saleDetailData(db, parsed.data);
          break;
        }
        case "statement": {
          const parsed = statementParamsSchema.safeParse(params);
          if (!parsed.success) throw new LensError("E_INVALID_PARAMS", "Invalid statement query");
          value = statementData(db, parsed.data);
          break;
        }
        case "summary": {
          const parsed = summaryParamsSchema.safeParse(params);
          if (!parsed.success) throw new LensError("E_INVALID_PARAMS", "Invalid summary query");
          value = summaryData(db, parsed.data, signal);
          break;
        }
      }
      checkCancelled(signal);
      return { kind: "ok" as const, value };
    });
  } catch (error) {
    if (error instanceof DomainFault) return { kind: "rejected" as const, issue: error.issue };
    throw error;
  }
}
