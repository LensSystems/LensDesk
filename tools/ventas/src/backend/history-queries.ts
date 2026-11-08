import type { HistoryPage, HistoryParams, HistoryRow } from "../shared/history-contracts.ts";
import type { Outflow, PaymentRecord } from "../shared/trading-contracts.ts";
import { reversal } from "./correction-records.ts";
import type { Db } from "./db/driver.ts";
import { DomainFault } from "./domain.ts";
import { historical } from "./historical-metadata.ts";
import { paymentAllocationPage } from "./payment-allocation-read.ts";

export function revision(db: Db, expected?: number): number {
  const current =
    db.get<{ revision: number }>("SELECT revision FROM meta WHERE id=1")?.revision ?? 0;
  if (expected !== undefined && expected !== current) throw new DomainFault("E_REVISION");
  return current;
}
function source(kind: HistoryParams["kind"]) {
  switch (kind) {
    case "sales":
      return {
        from: "sales s JOIN sale_balances b ON b.id=s.id",
        date: "s.date",
        order: "s.date DESC,s.at DESC,s.folio DESC",
        where: "1=1",
        client: "s.clientId",
        sale: "s.id",
        search: [
          "json_extract(s.clientSnapshot,'$.name')",
          "CAST(s.folio AS TEXT)",
          "s.note",
          "(SELECT legacyFolio FROM origins WHERE entity='sales' AND id=s.id)",
        ],
      };
    case "payments":
      return {
        from: "payments p LEFT JOIN payment_reversals r ON r.paymentId=p.id",
        date: "p.date",
        order: "p.date DESC,p.at DESC,p.folio DESC",
        where: "1=1",
        client: "p.clientId",
        sale: "",
        search: [
          "p.reference",
          "CAST(p.folio AS TEXT)",
          "(SELECT legacyFolio FROM origins WHERE entity='payments' AND id=p.id)",
        ],
      };
    case "returns":
      return {
        from: "returns r JOIN sales s ON s.id=r.saleId",
        date: "r.date",
        order: "r.date DESC,r.at DESC,r.folio DESC",
        where: "1=1",
        client: "s.clientId",
        sale: "r.saleId",
        search: [
          "r.reason",
          "CAST(r.folio AS TEXT)",
          "json_extract(s.clientSnapshot,'$.name')",
          "(SELECT legacyFolio FROM origins WHERE entity='returns' AND id=r.id)",
        ],
      };
    case "inventory":
      return {
        from: "movements m JOIN products p ON p.id=m.productId",
        date: "m.date",
        order: "m.date DESC,m.at DESC,m.id DESC",
        where: "1=1",
        client: "",
        sale: "",
        search: ["p.name", "m.reason", "m.referenceId"],
      };
    case "outflows":
      return {
        from: "outflows o",
        date: "o.date",
        order: "o.date DESC,o.at DESC,o.id DESC",
        where: "1=1",
        client: "",
        sale: "",
        search: ["o.concept", "o.category", "o.reference"],
      };
    case "purchases":
      return {
        from: "purchases c JOIN products p ON p.id=c.productId",
        date: "c.date",
        order: "c.date DESC,c.at DESC,c.id DESC",
        where: "1=1",
        client: "",
        sale: "",
        search: ["p.name", "c.id"],
      };
    case "closings":
      return {
        from: "cash_sessions c",
        date: "json_extract(c.closing,'$.closedDate')",
        order: "json_extract(c.closing,'$.closedAt') DESC,c.id DESC",
        where: "c.closing IS NOT NULL",
        client: "",
        sale: "",
        search: ["json_extract(c.closing,'$.reason')", "c.id"],
      };
  }
}
function selection(kind: HistoryParams["kind"]): string {
  switch (kind) {
    case "sales":
      return "s.id,s.folio,s.clientId,COALESCE(json_extract(s.clientSnapshot,'$.name'),'') AS clientName,s.date,s.due,s.total,b.total AS net,b.paid,b.pending,s.opening,s.note";
    case "payments":
      return "p.*,r.id AS reversalId";
    case "returns":
      return "r.*";
    case "inventory":
      return "m.*,p.name AS productName";
    case "outflows":
      return "o.*";
    case "purchases":
      return "c.*,p.name AS productName";
    case "closings":
      return "c.closing";
  }
}
function rows(
  db: Db,
  params: HistoryParams,
  sql: string,
  args: (string | number | null)[],
): HistoryRow[] {
  switch (params.kind) {
    case "sales":
      return db.all<Record<string, unknown>>(sql, ...args).map(
        (s) =>
          ({
            kind: "sale",
            data: {
              ...s,
              ...(historical(db, "sales", String(s.id)).legacyFolio
                ? { legacyFolio: historical(db, "sales", String(s.id)).legacyFolio }
                : {}),
              opening: Boolean(s.opening),
            },
          }) as HistoryRow,
      );
    case "payments":
      return db
        .all<
          Omit<PaymentRecord, "bankSnapshot" | "allocations" | "opening"> & {
            bankSnapshot: string;
            opening: number;
          }
        >(sql, ...args)
        .map((p) => ({
          kind: "payment",
          data: {
            ...p,
            ...historical(db, "payments", p.id),
            opening: Boolean(p.opening),
            bankSnapshot: JSON.parse(p.bankSnapshot),
            reversal: p.reversalId ? reversal(db, p.reversalId) : null,
            allocationPage: paymentAllocationPage(db, p.id, params.allocationOffset),
            applied: params.saleId
              ? (db.get<{ amount: number }>(
                  "SELECT amount FROM payment_allocations WHERE paymentId=? AND saleId=?",
                  p.id,
                  params.saleId,
                )?.amount ?? 0)
              : null,
          },
        }));
    case "returns":
      return db.all<Record<string, unknown>>(sql, ...args).map(
        (r) =>
          ({
            kind: "return",
            data: {
              ...r,
              ...historical(db, "returns", String(r.id)),
              restock: Boolean(r.restock),
              bankSnapshot: JSON.parse(String(r.bankSnapshot)),
            },
          }) as HistoryRow,
      );
    case "inventory":
      return db
        .all<Record<string, unknown>>(sql, ...args)
        .map((data) => ({ kind: "inventory", data }) as HistoryRow);
    case "outflows":
      return db
        .all<Omit<Outflow, "bankSnapshot"> & { bankSnapshot: string }>(sql, ...args)
        .map((o) => ({
          kind: "outflow",
          data: { ...o, bankSnapshot: JSON.parse(o.bankSnapshot) },
        }));
    case "purchases":
      return db.all<Record<string, unknown>>(sql, ...args).map(
        (c) =>
          ({
            kind: "purchase",
            data: {
              ...c,
              bankSnapshot: c.bankSnapshot ? JSON.parse(String(c.bankSnapshot)) : null,
            },
          }) as HistoryRow,
      );
    case "closings":
      return db.all<{ closing: string }>(sql, ...args).map((c) => ({
        kind: "closing",
        data: { refunds: 0, reversals: 0, ...JSON.parse(c.closing) },
      }));
  }
}
export function historyData(db: Db, params: HistoryParams): HistoryPage {
  const current = revision(db, params.revision),
    spec = source(params.kind),
    where = [spec.where],
    args: (string | number | null)[] = [];
  if (params.from && params.to && params.from > params.to) throw new DomainFault("E_PERIOD");
  if (params.paymentId || params.allocationOffset !== undefined) {
    if (params.kind !== "payments" || !params.paymentId) throw new DomainFault("E_PERIOD");
    where.push("p.id=?");
    args.push(params.paymentId);
  }
  if (params.clientId) {
    if (!spec.client) throw new DomainFault("E_PERIOD");
    where.push(`${spec.client}=?`);
    args.push(params.clientId);
  }
  if (params.saleId) {
    if (params.kind === "payments") {
      where.push(
        "EXISTS(SELECT 1 FROM payment_allocations a WHERE a.paymentId=p.id AND a.saleId=?)",
      );
      args.push(params.saleId);
    } else if (spec.sale) {
      where.push(`${spec.sale}=?`);
      args.push(params.saleId);
    } else throw new DomainFault("E_PERIOD");
  }
  if (params.from) {
    where.push(`${spec.date}>=?`);
    args.push(params.from);
  }
  if (params.to) {
    where.push(`${spec.date}<=?`);
    args.push(params.to);
  }
  if (params.query) {
    const pattern = `%${params.query
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\\%_]/g, "\\$&")}%`;
    where.push(
      `(${spec.search.map((field) => `ventas_fold(${field}) LIKE ? ESCAPE '\\'`).join(" OR ")})`,
    );
    args.push(...spec.search.map(() => pattern));
  }
  if (params.excludeOpening && params.kind === "sales") where.push("s.opening=0");
  const clause = `FROM ${spec.from} WHERE ${where.join(" AND ")}`,
    total = db.get<{ count: number }>(`SELECT COUNT(*) AS count ${clause}`, ...args)?.count ?? 0;
  const items = rows(
    db,
    params,
    `SELECT ${selection(params.kind)} ${clause} ORDER BY ${spec.order} LIMIT ? OFFSET ?`,
    [...args, params.limit, params.offset],
  );
  return {
    revision: current,
    total,
    nextOffset: params.offset + items.length < total ? params.offset + items.length : null,
    rows: items,
  };
}
