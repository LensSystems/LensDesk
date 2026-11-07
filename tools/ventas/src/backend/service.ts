import { randomUUID } from "node:crypto";
import { LensError } from "@lensdesk/sdk/errors";
import {
  commandSchema,
  type MutationResult,
  mutationResultSchema,
  type Snapshot,
} from "../shared/contracts.ts";
import type { Db } from "./db/driver.ts";
import { checkCancelled, DomainFault } from "./domain.ts";
import { adjust, clock, prepare, receive } from "./inventory-repo.ts";
import { product, products, saveProduct, saveRecipe } from "./products-repo.ts";

export function snapshot(db: Db): Snapshot {
  return db.transaction(() => ({
    revision: db.get<{ revision: number }>("SELECT revision FROM meta WHERE id=1")?.revision ?? 0,
    settings: JSON.parse(
      db.get<{ data: string }>("SELECT data FROM settings WHERE id=1")?.data ?? "{}",
    ),
    products: products(db),
    recipes: db.all("SELECT * FROM recipes ORDER BY productId"),
    movements: db.all("SELECT * FROM movements ORDER BY at DESC, rowid DESC LIMIT 1000"),
    purchases: db.all("SELECT * FROM purchases ORDER BY at DESC, rowid DESC LIMIT 1000"),
  }));
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
        case "saveSettings":
          db.run("UPDATE settings SET data=? WHERE id=1", JSON.stringify(action.settings));
          id = randomUUID();
          break;
      }
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
