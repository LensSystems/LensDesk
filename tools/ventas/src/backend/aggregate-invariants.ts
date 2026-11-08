import type { Action } from "../shared/contracts.ts";
import { account } from "./accounts-repo.ts";
import { cash } from "./cash-repo.ts";
import type { Db } from "./db/driver.ts";

export function validateAggregates(db: Db, action: Action, id: string, today: string): void {
  let clientId: string | null = null;
  let changedCash = false;
  switch (action.type) {
    case "sell":
      clientId =
        db.get<{ clientId: string | null }>("SELECT clientId FROM sales WHERE id=?", id)
          ?.clientId ?? null;
      changedCash = action.payment.amount > 0 && action.payment.method === "cash";
      break;
    case "payAccount":
      clientId = action.clientId;
      changedCash = action.payment.method === "cash";
      break;
    case "openingBalance":
      clientId = action.clientId;
      break;
    case "receive":
      changedCash = action.method === "cash";
      break;
    case "outflow":
      changedCash = action.payment.method === "cash";
      break;
    case "openCash":
      changedCash = true;
      break;
  }
  if (clientId) account(db, clientId, today);
  if (changedCash) cash(db);
}
