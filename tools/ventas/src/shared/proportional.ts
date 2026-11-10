/** Integer half-up rounding of a portion; callers validate inputs and bound the result. */
export function proportionalInteger(value: number, qty: number, stock: number): bigint {
  return (BigInt(value) * BigInt(qty) * 2n + BigInt(stock)) / (BigInt(stock) * 2n);
}
