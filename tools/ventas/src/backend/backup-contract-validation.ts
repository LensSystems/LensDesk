import type { Dataset } from "../shared/backup-contracts.ts";
import { snapshotResultSchema } from "../shared/contracts.ts";
import { clientSchema, draftSchema, outflowSchema } from "../shared/trading-contracts.ts";
import { settingsSchema } from "../shared/values.ts";
import { DomainFault } from "./domain.ts";
export function* contractSteps(data: Dataset) {
  const shape = snapshotResultSchema.shape.value.shape;
  if (
    data.settings.length !== 1 ||
    data.settings[0]?.id !== 1 ||
    data.draft.length !== 1 ||
    data.draft[0]?.id !== 1
  )
    throw new DomainFault("E_BACKUP_REFS");
  settingsSchema.parse(JSON.parse(String(data.settings[0].data)));
  draftSchema.parse({ clientId: data.draft[0].clientId, lines: data.draft_lines });
  for (const row of data.products) {
    yield;
    shape.products.element.parse({ ...row, active: Boolean(row.active) });
  }
  for (const row of data.recipes) {
    yield;
    shape.recipes.element.parse(row);
  }
  for (const row of data.movements) {
    yield;
    shape.movements.element.parse(row);
  }
  for (const row of data.purchases) {
    yield;
    shape.purchases.element.parse({
      ...row,
      bankSnapshot: row.bankSnapshot === null ? null : JSON.parse(String(row.bankSnapshot)),
    });
  }
  for (const row of data.outflows) {
    yield;
    outflowSchema.parse({ ...row, bankSnapshot: JSON.parse(String(row.bankSnapshot)) });
  }
  for (const table of [
    "purchases",
    "outflows",
    "payments",
    "returns",
    "payment_reversals",
  ] as const)
    for (const row of data[table]) {
      yield;
      const snapshot = row.bankSnapshot === null ? null : JSON.parse(String(row.bankSnapshot));
      if (snapshot !== null && (snapshot.id !== row.bankId || row.method !== "transfer"))
        throw new DomainFault("E_BACKUP_REFS");
    }
  for (const row of data.clients) {
    yield;
    const { creditLimit, active, ...client } = row;
    clientSchema.parse({ ...client, limit: creditLimit, active: Boolean(active) });
  }
}
