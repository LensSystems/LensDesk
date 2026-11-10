import { randomUUID } from "node:crypto";
import { LensError } from "@lensdesk/sdk/errors";
import {
  commandSchema,
  type MutationResult,
  mutationResultSchema,
  type Snapshot,
} from "../shared/contracts.ts";
import { normalizeSettings, settingsSchema } from "../shared/values.ts";
import { accountSummaries } from "./accounts-repo.ts";
import { validateAggregates } from "./aggregate-invariants.ts";
import { cash, closeCash, closings, openCash } from "./cash-repo.ts";
import { client, clients, saveClient, saveDraft } from "./clients-repo.ts";
import type { Db } from "./db/driver.ts";
import { checkCancelled, DomainFault } from "./domain.ts";
import { adjust, clock, prepare, receive } from "./inventory-repo.ts";
import { outflow, payAccount } from "./payments-repo.ts";
import { product, products, saveProduct, saveRecipe } from "./products-repo.ts";
import { returnSale, reversePayment } from "./returns-repo.ts";
import { openingBalance, sell } from "./sales-repo.ts";
import { draft, outflows } from "./trade-records.ts";

export function snapshot(db: Db): Snapshot {
  return db.transaction(() => {
    const allClients = clients(db),
      today = clock().date;
    return {
      revision: db.get<{ revision: number }>("SELECT revision FROM meta WHERE id=1")?.revision ?? 0,
      settings: JSON.parse(
        db.get<{ data: string }>("SELECT data FROM settings WHERE id=1")?.data ?? "{}",
      ),
      products: products(db),
      recipes: db.all("SELECT * FROM recipes ORDER BY productId"),
      movements: db.all("SELECT * FROM movements ORDER BY at DESC, rowid DESC LIMIT 50"),
      purchases: db
        .all<Omit<Snapshot["purchases"][number], "bankSnapshot"> & { bankSnapshot: string | null }>(
          "SELECT * FROM purchases ORDER BY at DESC, rowid DESC LIMIT 50",
        )
        .map((p) => ({ ...p, bankSnapshot: p.bankSnapshot ? JSON.parse(p.bankSnapshot) : null })),
      clients: allClients,
      accounts: accountSummaries(
        db,
        allClients.map((c) => c.id),
        today,
      ),
      cash: cash(db),
      closings: closings(db),
      outflows: outflows(db),
      draft: draft(db),
      today,
    };
  });
}
export function execute(db: Db, params: unknown, signal: AbortSignal): MutationResult {
  const parsed = commandSchema.safeParse(params);
  if (!parsed.success) throw new LensError("E_INVALID_PARAMS", "Invalid sales command");
  const command = parsed.data;
  const fingerprint = JSON.stringify(command.action);
  checkCancelled(signal);
  try {
    return db.transaction(() => {
      const prior = db.get<{ fingerprint: string; result: string }>(
        "SELECT * FROM operations WHERE key=?",
        command.key,
      );
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new DomainFault("E_DUPLICATE");
        return mutationResultSchema.parse(JSON.parse(prior.result));
      }
      const revision =
        db.get<{ revision: number }>("SELECT revision FROM meta WHERE id=1")?.revision ?? 0;
      if (revision !== command.revision) throw new DomainFault("E_REVISION");
      if (!Number.isSafeInteger(revision + 1)) throw new DomainFault("E_LIMIT");
      const action = command.action;
      const time = clock();
      let id: string;
      switch (action.type) {
        case "saveProduct":
          id = saveProduct(db, action.product);
          break;
        case "saveRecipe":
          id = saveRecipe(db, action.recipe);
          break;
        case "setActive":
          product(db, action.id, false);
          db.run("UPDATE products SET active=? WHERE id=?", Number(action.active), action.id);
          id = action.id;
          break;
        case "receive":
          id = receive(db, action, time);
          break;
        case "prepare":
          id = prepare(db, action, time);
          break;
        case "adjust":
          id = adjust(db, action, time);
          break;
        case "saveClient":
          id = saveClient(db, action.client);
          break;
        case "setClientActive":
          client(db, action.id);
          db.run("UPDATE clients SET active=? WHERE id=?", Number(action.active), action.id);
          id = action.id;
          break;
        case "saveDraft":
          id = saveDraft(db, action.draft);
          break;
        case "sell":
          id = sell(db, action, time);
          break;
        case "payAccount":
          id = payAccount(db, action.clientId, action.payment, time);
          break;
        case "returnSale":
          id = returnSale(db, action, time);
          break;
        case "reversePayment":
          id = reversePayment(db, action, time);
          break;
        case "openingBalance":
          id = openingBalance(db, action, time);
          break;
        case "openCash":
          id = openCash(db, action.initial, time);
          break;
        case "closeCash":
          id = closeCash(db, action.counted, action.reason, time);
          break;
        case "outflow":
          id = outflow(db, action, time);
          break;
        case "saveSettings":
          if (!settingsSchema.safeParse(action.settings).success)
            throw new LensError("E_INVALID_PARAMS", "Invalid settings references");
          db.run(
            "UPDATE settings SET data=? WHERE id=1",
            JSON.stringify(normalizeSettings(action.settings)),
          );
          id = randomUUID();
          break;
      }
      validateAggregates(db, action, id, time.date);
      checkCancelled(signal);
      db.run("UPDATE meta SET revision=revision+1 WHERE id=1");
      const result: MutationResult = { kind: "ok", value: { id, revision: revision + 1 } };
      db.run(
        "INSERT INTO operations VALUES(?,?,?)",
        command.key,
        fingerprint,
        JSON.stringify(result),
      );
      return result;
    });
  } catch (error) {
    if (error instanceof DomainFault) return { kind: "rejected", issue: error.issue };
    throw error;
  }
}
