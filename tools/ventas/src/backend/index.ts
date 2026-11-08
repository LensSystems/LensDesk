import { type BackendMethod, defineBackend } from "@lensdesk/sdk/backend";
import { LensError } from "@lensdesk/sdk/errors";
import { z } from "zod";
import type { Db } from "./db/driver.ts";
import { openVentasDatabase } from "./db/driver.ts";
import { checkCancelled } from "./domain.ts";
import { query } from "./queries.ts";
import { execute, snapshot } from "./service.ts";

const databases = new Map<string, Db>();
function database(dataDir: string): Db {
  let db = databases.get(dataDir);
  if (!db) {
    db = openVentasDatabase(dataDir);
    databases.set(dataDir, db);
  }
  return db;
}
export const methods = {
  snapshot(params, ctx) {
    if (!z.strictObject({}).optional().nullable().safeParse(params).success)
      throw new LensError("E_INVALID_PARAMS", "No parameters expected");
    checkCancelled(ctx.signal);
    return { kind: "ok", value: snapshot(database(ctx.dataDir)) };
  },
  history: (params, ctx) => query(database(ctx.dataDir), "history", params, ctx.signal),
  returnDetail: (params, ctx) => query(database(ctx.dataDir), "returnDetail", params, ctx.signal),
  saleDetail: (params, ctx) => query(database(ctx.dataDir), "saleDetail", params, ctx.signal),
  statement: (params, ctx) => query(database(ctx.dataDir), "statement", params, ctx.signal),
  summary: (params, ctx) => query(database(ctx.dataDir), "summary", params, ctx.signal),
  execute: (params, ctx) => execute(database(ctx.dataDir), params, ctx.signal),
} satisfies Record<string, BackendMethod>;

defineBackend({ methods });
