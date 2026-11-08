import type { NativeBackup } from "../shared/backup-contracts.ts";
import { cooperate, drain } from "./backup-cooperation.ts";
import { encode, hash } from "./backup-json.ts";
import { mapCash } from "./web-cash.ts";
import { context, number, time, uuid } from "./web-common.ts";
import { mapMovements, mapProducts } from "./web-inventory.ts";
import { mapClientsSales } from "./web-trading.ts";
export function adaptWeb(raw: unknown) {
  return drain(webSteps(raw));
}
export async function adaptWebAsync(raw: unknown, signal: AbortSignal) {
  return await cooperate(webSteps(raw), signal);
}
function* webSteps(
  raw: unknown,
): Generator<unknown, { backup: NativeBackup; limitations: string[] }, unknown> {
  const c = context(raw);
  yield* mapProducts(c);
  yield* mapClientsSales(c);
  yield* mapCash(c);
  yield* mapMovements(c);
  if (c.data.payment_reversals.length && c.data.returns.length)
    c.limitations.add("correctionOrderUnknown");
  const payload = JSON.stringify(raw),
    digest = hash(encode(raw));
  c.data.import_archives.push({
    id: uuid("archive", digest),
    format: "web1",
    hash: digest,
    payload,
  });
  c.origin("import_archives", uuid("archive", digest), "web1", [...c.limitations]);
  return {
    backup: {
      format: "lensdesk-ventas-native-backup",
      version: 1,
      modelVersion: 6,
      createdAt: time((raw as Record<string, unknown>).createdAt),
      toolVersion: "0.1.0",
      revision: number(c.ledger.revision, Number.MAX_SAFE_INTEGER),
      data: c.data,
    },
    limitations: [...c.limitations],
  };
}
