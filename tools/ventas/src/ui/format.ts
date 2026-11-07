export function moneyText(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "MXN" }).format(cents / 100);
}
export function numberText(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}
export function parseMoney(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return Number.NaN;
  const [whole = "", fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : Number.NaN;
}
