import { z } from "zod";
import { issueSchema } from "./contracts.ts";
export function queryResultSchema<T extends z.ZodType>(schema: T) {
  return z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("ok"), value: schema }),
    z.strictObject({ kind: z.literal("rejected"), issue: issueSchema }),
  ]);
}

import type { VentasIssue } from "./contracts.ts";

const envelope = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("ok"), value: z.unknown() }),
  z.strictObject({ kind: z.literal("rejected"), issue: issueSchema }),
]);
export function parseQueryResult<T extends z.ZodType>(
  schema: T,
  raw: unknown,
): { kind: "ok"; value: z.output<T> } | { kind: "rejected"; issue: VentasIssue } {
  const result = envelope.parse(raw);
  return result.kind === "ok" ? { kind: "ok", value: schema.parse(result.value) } : result;
}
