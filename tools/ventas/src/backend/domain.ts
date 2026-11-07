import { LensError } from "@lensdesk/sdk/errors";
import type { VentasIssue } from "../shared/contracts.ts";

export class DomainFault extends Error {
  readonly issue: VentasIssue;
  constructor(code: VentasIssue["code"], productId?: string) {
    super(code);
    this.issue = { code, ...(productId ? { productId } : {}) };
  }
}
export function checkCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new LensError("E_CANCELLED", "Request cancelled");
}
export function checked(value: number, max = 9_000_000_000_000): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new DomainFault("E_LIMIT");
  return value;
}
export function proportional(value: number, qty: number, stock: number): number {
  if (stock <= 0) throw new DomainFault("E_COST");
  return checked(Number((BigInt(value) * BigInt(qty) * 2n + BigInt(stock)) / (BigInt(stock) * 2n)));
}
export function operationalDate(at: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(at));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
