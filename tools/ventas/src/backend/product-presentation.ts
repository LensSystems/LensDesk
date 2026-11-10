import type { Dataset } from "../shared/backup-contracts.ts";
import { knownProductIcon, type ProductIconName } from "../shared/product-icons.ts";

type Sources = Pick<Dataset, "products" | "origins" | "import_archives">;
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function identity(value: unknown): string | null {
  return (typeof value === "string" && value.length > 0 && value.length <= 200) ||
    (typeof value === "number" && Number.isSafeInteger(value))
    ? JSON.stringify(value)
    : null;
}
export function* recoverProductIcons(data: Sources) {
  const icons = new Map<string, ProductIconName | null>();
  let complete = true;
  for (const archive of data.import_archives) {
    yield;
    if (archive.format !== "web1") continue;
    let raw: Record<string, unknown> | null;
    try {
      raw = record(JSON.parse(String(archive.payload)));
    } catch {
      complete = false;
      continue;
    }
    const ledger = record(raw?.ledger),
      products = ledger?.products;
    if (
      raw?.format !== "lensdesk-ventas-backup" ||
      raw.version !== 1 ||
      !Array.isArray(products) ||
      products.length > 100000
    ) {
      complete = false;
      continue;
    }
    const seen = new Set<string>();
    for (const item of products) {
      yield;
      const product = record(item),
        key = identity(product?.id);
      if (!key) continue;
      const icon = knownProductIcon(product?.icon);
      icons.set(key, seen.has(key) || (icons.has(key) && icons.get(key) !== icon) ? null : icon);
      seen.add(key);
    }
  }
  const origins = new Map<unknown, string | null>();
  for (const origin of data.origins) {
    yield;
    if (origin.entity !== "products") continue;
    let key: string | null = null;
    try {
      key = identity(JSON.parse(String(origin.sourceId)));
    } catch {
      /* Unknown origin. */
    }
    origins.set(origin.id, origins.has(origin.id) ? null : key);
  }
  for (const product of data.products) {
    yield;
    const key = origins.get(product.id);
    product.icon = complete && key ? (icons.get(key) ?? null) : null;
  }
}
