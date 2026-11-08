export function moneyText(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale.startsWith("es") ? "es-MX" : "en-US", {
    style: "currency",
    currency: "MXN",
  }).format(cents / 100);
}
export function numberText(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}
export function parseMoney(value: string): number {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/.test(value)) return Number.NaN;
  const [whole = "", fraction = ""] = value.replaceAll(",", "").split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return cents <= 9_000_000_000_000n ? Number(cents) : Number.NaN;
}

export function inputMoney(raw: string): string | null {
  const clean = raw.replaceAll(",", "");
  if (!/^\d*(?:\.\d{0,2})?$/.test(clean)) return null;
  const [whole = "", fraction] = clean.split(".");
  const digits = whole.replace(/^0+(?=\d)/, "");
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return grouped + (fraction === undefined ? "" : `.${fraction}`);
}
export function saleFolio(sale: { folio: number; opening: boolean }): string {
  return `${sale.opening ? "SI" : "V"}-${String(sale.folio).padStart(6, "0")}`;
}

export function dateText(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale.startsWith("es") ? "es-MX" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
