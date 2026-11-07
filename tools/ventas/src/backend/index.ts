import { type BackendMethod, defineBackend } from "@lensdesk/sdk/backend";
import { LensError } from "@lensdesk/sdk/errors";
import { z } from "zod";
import type { Db } from "./db/driver.ts";
import { openVentasDatabase } from "./db/driver.ts";
import { checkCancelled } from "./domain.ts";
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
  execute: (params, ctx) => execute(database(ctx.dataDir), params, ctx.signal),
} satisfies Record<string, BackendMethod>;

defineBackend({ methods });
