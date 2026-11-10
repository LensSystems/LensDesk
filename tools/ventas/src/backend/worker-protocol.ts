import { LENS_ERROR_CODES, LensError } from "@lensdesk/sdk/errors";
import { z } from "zod";

export const workerMarker = "ventas-database-v1";
export const methodNames = [
  "snapshot",
  "history",
  "returnDetail",
  "saleDetail",
  "statement",
  "summary",
  "backupInfo",
  "backupExport",
  "backupPrepare",
  "confirmRestore",
  "execute",
] as const;
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const bytes = z.custom<Uint8Array>((value) => value instanceof Uint8Array);
const error = z.strictObject({ code: z.enum(LENS_ERROR_CODES) });
export const toWorkerSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("run"), id, method: z.enum(methodNames), params: z.unknown() }),
  z.strictObject({ type: z.literal("cancel"), id }),
  z.strictObject({ type: z.literal("close") }),
  z.strictObject({
    type: z.literal("file-result"),
    id,
    callId: id,
    result: z.discriminatedUnion("ok", [
      z.strictObject({ ok: z.literal(true), bytes: bytes.optional() }),
      z.strictObject({ ok: z.literal(false), error }),
    ]),
  }),
]);
export const fromWorkerSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("result"), id, result: z.unknown() }),
  z.strictObject({ type: z.literal("error"), id, error }),
  z.strictObject({
    type: z.literal("progress"),
    id,
    fraction: z.number().min(0).max(1),
    phase: z
      .enum([
        "reading",
        "writing",
        "validating",
        "reconciling",
        "ready",
        "copying",
        "restoring",
        "staging",
        "committing",
      ])
      .optional(),
  }),
  z.strictObject({
    type: z.literal("file-call"),
    id,
    callId: id,
    token: z.string().min(1).max(500),
    operation: z.discriminatedUnion("op", [
      z.strictObject({ op: z.literal("readBytes") }),
      z.strictObject({ op: z.literal("writeBytes"), bytes }),
    ]),
  }),
]);
export type ToWorker = z.infer<typeof toWorkerSchema>;
export type FromWorker = z.infer<typeof fromWorkerSchema>;
export type MethodName = (typeof methodNames)[number];
export function safeError(error: unknown) {
  return { code: error instanceof LensError ? error.code : ("E_INTERNAL" as const) };
}
export function transportError(code: (typeof LENS_ERROR_CODES)[number]) {
  return new LensError(
    code,
    code === "E_CANCELLED" ? "Request cancelled" : "Ventas backend operation failed",
  );
}
