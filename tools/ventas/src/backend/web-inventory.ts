import { DomainFault } from "./domain.ts";
import { bool, number, object, sourceId, text, uuid, type WebContext } from "./web-common.ts";
export function* mapProducts(c: WebContext) {
  for (const p of c.collections.products ?? []) {
    yield;
    const id = c.ref("products", p.id),
      stock = number(p.stock, 1e9),
      value = number(p.value);
    if (
      !["simple", "material", "prepared"].includes(String(p.kind)) ||
      !["g", "pza"].includes(String(p.unit)) ||
      (p.kind !== "material" && p.unit !== "pza")
    )
      throw new DomainFault("E_BACKUP_FORMAT");
    if (typeof p.lastCost !== "number" || !Number.isFinite(p.lastCost) || p.lastCost < 0)
      throw new DomainFault("E_BACKUP_COST");
    const movements = c.movementsByProduct.get(sourceId(p.id)) ?? [];
    const baseStock =
        BigInt(stock) - movements.reduce((n, m) => n + BigInt(number(m.qty, 1e9, -1e9)), 0n),
      baseValue =
        BigInt(value) - movements.reduce((n, m) => n + BigInt(number(m.value, 9e12, -9e12)), 0n);
    if (
      baseStock < 0n ||
      baseStock > 1000000000n ||
      baseValue < 0n ||
      baseValue > 9000000000000n ||
      (!baseStock && baseValue)
    )
      throw new DomainFault("E_BACKUP_REFS");
    let n = Number(baseValue),
      d = Number(baseStock) || 1,
      q = baseStock,
      v = baseValue;
    for (const m of movements) {
      q += BigInt(number(m.qty, 1e9, -1e9));
      v += BigInt(number(m.value, 9e12, -9e12));
      if (q < 0n || v < 0n || (!q && v)) throw new DomainFault("E_BACKUP_REFS");
      if (q > 0n) {
        n = Number(v);
        d = Number(q);
      }
    }
    if (stock) {
      n = value;
      d = stock;
    }
    if (n / d !== p.lastCost) {
      const r = fraction(p.lastCost);
      n = r[0];
      d = r[1];
      if (stock && n / d !== value / stock) throw new DomainFault("E_BACKUP_COST");
    }
    c.data.products.push({
      id,
      name: text(p.name),
      category: text(p.cat),
      kind: String(p.kind),
      unit: p.unit === "pza" ? "piece" : "g",
      price: number(p.price),
      minStock: number(p.minStock, 1e9),
      stock,
      value,
      lastValue: n,
      lastQty: d,
      active: Number(bool(p.active)),
    });
    c.data.inventory_bases.push({
      productId: id,
      stock: Number(baseStock),
      value: Number(baseValue),
    });
    c.origin("products", id, p.id);
    if (p.kind === "prepared") {
      const r = object(p.recipe);
      c.data.recipes.push({
        productId: id,
        materialId: c.ref("products", r.material),
        grams: number(r.grams, 1e9, 1),
        packagingId: r.pack ? c.ref("products", r.pack) : null,
      });
    }
  }
}
function fraction(value: number): [number, number] {
  const [mantissa = "", e = "0"] = String(value).toLowerCase().split("e"),
    [whole = "", decimal = ""] = mantissa.split(".");
  let n = BigInt(whole + decimal),
    d = 10n ** BigInt(decimal.length),
    exp = Number(e);
  if (exp > 0) n *= 10n ** BigInt(exp);
  else d *= 10n ** BigInt(-exp);
  let a = n,
    b = d;
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  if (a) {
    n /= a;
    d /= a;
  }
  if (n > 9000000000000n || d > 1000000000n) throw new DomainFault("E_BACKUP_COST");
  return [Number(n), Number(d)];
}
export function* mapMovements(c: WebContext) {
  const kinds: Record<string, string> = {
    Compra: "purchase",
    Venta: "sale",
    Devolución: "return",
    Preparación: "preparation",
    Ajuste: "adjustment",
    Merma: "waste",
  };
  for (const m of c.collections.movements ?? []) {
    yield;
    const kind = kinds[text(m.kind)],
      id = c.ref("movements", m.id);
    if (!kind) throw new DomainFault("E_BACKUP_FORMAT");
    const referenceId =
      kind === "purchase"
        ? c.ref("outflows", m.ref)
        : kind === "sale"
          ? c.ref("sales", m.ref)
          : kind === "return"
            ? c.ref("returns", m.ref)
            : kind === "preparation"
              ? c.ref("preparations", m.ref)
              : uuid("adjustment", m.ref);
    c.data.movements.push({
      id,
      productId: c.ref("products", m.product),
      qty: number(m.qty, 1e9, -1e9),
      value: number(m.value, 9e12, -9e12),
      kind,
      referenceId,
      reason: text(m.note ?? "", 500),
      at: time(m.at),
      date: day(m.date),
    });
    c.origin("movements", id, m.id);
  }
  const grouped = new Map<string, typeof c.data.movements>();
  for (const m of c.data.movements) {
    const group = grouped.get(String(m.referenceId)) ?? [];
    group.push(m);
    grouped.set(String(m.referenceId), group);
  }
  const products = new Map(c.data.products.map((p) => [p.id, p]));
  for (const p of c.collections.preparations ?? []) {
    yield;
    number(p.qty, 1e9, 1);
    number(p.grams, 1e9, 1);
    number(p.cost);
    const id = c.ref("preparations", p.id);
    const moves = grouped.get(id) ?? [],
      positive = moves.find((m) => m.qty === p.qty && m.productId === c.ref("products", p.product));
    if (
      !positive ||
      positive.value !== p.cost ||
      -moves
        .filter((m) => Number(m.qty) < 0 && products.get(m.productId)?.unit === "g")
        .reduce((n, m) => n + Number(m.qty), 0) !== p.grams
    )
      throw new DomainFault("E_BACKUP_REFS");
    c.origin("preparations", id, p.id);
  }
}

import { day, time } from "./web-common.ts";
