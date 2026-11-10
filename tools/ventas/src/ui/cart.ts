import type { Snapshot } from "../shared/contracts.ts";
export function cartTotal(data: Snapshot): number | null {
  let total = 0n;
  for (const line of data.draft.lines) {
    const p = data.products.find((p) => p.id === line.productId);
    if (!p) return null;
    total += BigInt(p.price) * BigInt(line.qty);
  }
  return total <= 9_000_000_000_000n ? Number(total) : null;
}
