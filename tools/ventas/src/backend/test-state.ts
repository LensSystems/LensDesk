import { account } from "./accounts-repo.ts";
import { returnRecord, reversal } from "./correction-records.ts";
import type { Db } from "./db/driver.ts";
import { snapshot } from "./service.ts";
import { outflows, payments, sales } from "./trade-records.ts";
export function testState(db: Db) {
  const compact = snapshot(db);
  return {
    ...compact,
    returns: db
      .all<{ id: string }>("SELECT id FROM returns ORDER BY rowid")
      .map((r) => returnRecord(db, r.id)),
    reversals: db
      .all<{ id: string }>("SELECT id FROM payment_reversals ORDER BY rowid")
      .map((r) => reversal(db, r.id)),
    sales: sales(db),
    payments: payments(db),
    accounts: compact.accounts.map((c) => account(db, c.clientId, compact.today)),
    outflows: outflows(db, 1000000),
  };
}
