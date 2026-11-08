import { bounded, DomainFault } from "./domain.ts";
import {
  bank,
  bankRef,
  bool,
  business,
  cashRef,
  clientRef,
  day,
  list,
  method,
  number,
  object,
  sourceId,
  text,
  time,
  uuid,
  type WebContext,
} from "./web-common.ts";
export function* mapClientsSales(c: WebContext) {
  c.data.settings = [{ id: 1, data: JSON.stringify(business(c, c.business)) }];
  for (const r of c.collections.clients ?? []) {
    yield;
    const id = c.ref("clients", r.id);
    c.data.clients.push({
      id,
      name: text(r.name),
      phone: text(r.phone, 40),
      term: number(r.term, 30, 1),
      creditLimit: r.limit === null ? null : number(r.limit),
      active: Number(bool(r.active)),
    });
    c.origin("clients", id, r.id);
  }
  const lineMap = new Map<string, string>();
  c.maps.set("lines", lineMap);
  for (const [index, s] of (c.collections.sales ?? []).entries()) {
    yield;
    const id = c.ref("sales", s.id),
      clientId = clientRef(c, s.client),
      missing: string[] = [],
      opening = s.opening === undefined ? false : bool(s.opening),
      lines = list(s.lines);
    const seen = new Set<string>();
    const mapped = lines.map((l) => {
      const productId = c.ref("products", l.product),
        key = JSON.stringify([sourceId(s.id), sourceId(l.product)]);
      if (seen.has(productId)) throw new DomainFault("E_BACKUP_REFS");
      seen.add(productId);
      const lid = uuid("lines", key);
      lineMap.set(key, lid);
      return {
        id: lid,
        productId,
        name: text(l.name),
        qty: number(l.qty, 1e9, 1),
        price: number(l.price),
        cost: number(l.cost),
      };
    });
    let clientSnapshot: unknown = null;
    if (clientId) {
      if (typeof s.clientName === "string" && s.clientName.trim()) {
        clientSnapshot = {
          id: clientId,
          name: text(s.clientName),
          phone: "",
          term: number(s.term, 30),
          limit: null,
          active: true,
        };
        missing.push("clientDetails");
      } else missing.push("client");
    }
    let historical: unknown = { name: "", address: "", phone: "", thanks: "", banks: [] };
    if (s.business) historical = business(c, s.business);
    else missing.push("business");
    const received = s.received === undefined ? 0 : number(s.received),
      change = s.change === undefined ? 0 : number(s.change);
    if (!opening && s.received === undefined) missing.push("received");
    if (!opening && s.change === undefined) missing.push("change");
    const initialPaymentId = s.initialPaymentId ? c.ref("payments", s.initialPaymentId) : null;
    if (!opening && !initialPaymentId && (received > 0 || s.received === undefined))
      missing.push("initialPayment");
    c.data.sales.push({
      id,
      folio: index + 1,
      clientId,
      clientSnapshot: JSON.stringify(clientSnapshot),
      business: JSON.stringify(historical),
      lines: JSON.stringify(mapped),
      total: number(s.total),
      term: number(s.term, 30),
      due: day(s.due),
      exception: text(s.exception ?? "", 500),
      opening: Number(opening),
      note: text(s.note ?? "", 500),
      received,
      change,
      at: time(s.at),
      date: day(s.date),
      initialPaymentId,
    });
    c.origin("sales", id, s.id, missing);
  }
  for (const [index, p] of (c.collections.payments ?? []).entries()) {
    yield;
    const id = c.ref("payments", p.id),
      m = method(p.method),
      bankId = m === "transfer" ? bankRef(c, p.bank, p.bankSnapshot) : null;
    c.data.payments.push({
      id,
      folio: index + 1,
      clientId: clientRef(c, p.client),
      amount: number(p.amount, 9e12, 1),
      method: m,
      bankId,
      bankSnapshot: JSON.stringify(bank(c, p.bankSnapshot, p.bank)),
      reference: text(p.reference ?? "", 200),
      cashId: cashRef(c, p.cashId),
      at: time(p.at),
      date: day(p.date),
      opening: Number(p.opening === undefined ? false : bool(p.opening)),
    });
    for (const a of list(p.allocations))
      c.data.payment_allocations.push({
        paymentId: id,
        saleId: c.ref("sales", a.sale),
        amount: number(a.amount, 9e12, 1),
      });
    c.origin(
      "payments",
      id,
      p.id,
      p.bankSnapshot === undefined && m === "transfer" ? ["bank"] : [],
    );
    if (p.reversed) {
      const r = object(p.reversed),
        rid = uuid("reversal", p.id);
      c.data.payment_reversals.push({
        id: rid,
        folio: c.data.payment_reversals.length + 1,
        paymentId: id,
        reason: text(r.reason, 500),
        amount: number(p.amount),
        method: m,
        bankId,
        bankSnapshot: JSON.stringify(bank(c, p.bankSnapshot, p.bank)),
        reference: text(p.reference ?? "", 200),
        cashId: cashRef(c, r.cashId),
        at: time(r.at),
        date: day(r.date),
      });
      c.origin("payment_reversals", rid, p.id);
    }
  }
  for (const [index, r] of (c.collections.returns ?? []).entries()) {
    yield;
    const id = c.ref("returns", r.id),
      saleId = c.ref("sales", r.sale),
      original = c.data.sales.find((s) => s.id === saleId);
    if (!original) throw new DomainFault("E_BACKUP_REFS");
    const saleLines = JSON.parse(String(original.lines)) as {
      id: string;
      productId: string;
      price: number;
    }[];
    for (const l of list(r.lines)) {
      const key = JSON.stringify([sourceId(r.sale), sourceId(l.product)]),
        lineId = lineMap.get(key),
        productId = c.ref("products", l.product),
        line = saleLines.find((x) => x.id === lineId);
      if (!lineId || !line) throw new DomainFault("E_BACKUP_REFS");
      const qty = number(l.qty, 1e9, 1);
      c.data.return_lines.push({
        id: uuid("return_lines", JSON.stringify([sourceId(r.id), sourceId(l.product)])),
        returnId: id,
        lineId,
        productId,
        qty,
        amount: bounded(BigInt(qty) * BigInt(line.price)),
        cost: number(l.cost),
      });
    }
    const refund = number(r.refund),
      m = refund ? method(r.method) : null,
      bankId = m === "transfer" ? bankRef(c, r.bank, r.bankSnapshot) : null;
    c.data.returns.push({
      id,
      folio: index + 1,
      saleId,
      reason: text(r.reason, 500),
      restock: Number(bool(r.restock)),
      amount: number(r.amount),
      cost: number(r.cost),
      refund,
      method: m,
      bankId,
      bankSnapshot: JSON.stringify(refund ? bank(c, r.bankSnapshot, r.bank) : null),
      reference: text(r.reference ?? "", 200),
      cashId: refund ? cashRef(c, r.cashId) : null,
      at: time(r.at),
      date: day(r.date),
    });
    c.origin("returns", id, r.id, m === "transfer" && !r.bankSnapshot ? ["bank"] : []);
  }
  for (const row of c.data.sequences)
    row.value =
      {
        sale: c.data.sales.length,
        payment: c.data.payments.length,
        return: c.data.returns.length,
        reversal: c.data.payment_reversals.length,
      }[String(row.name)] ?? 0;
  const draft = object(c.ledger.draft),
    cart = object(draft.cart);
  c.data.draft = [{ id: 1, clientId: clientRef(c, draft.client) }];
  for (const [src, qty] of Object.entries(cart)) {
    const productId = c.ref("products", src);
    if (c.data.products.find((p) => p.id === productId)?.kind === "material")
      throw new DomainFault("E_BACKUP_REFS");
    c.data.draft_lines.push({ productId, qty: number(qty, 1e9, 1) });
  }
}
