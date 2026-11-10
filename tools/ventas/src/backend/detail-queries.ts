import type { z } from "zod";
import type {
  SaleDetail,
  Statement,
  saleDetailParamsSchema,
  statementParamsSchema,
} from "../shared/history-contracts.ts";
import { account, saleBalance } from "./accounts-repo.ts";
import { client } from "./clients-repo.ts";
import { payment, returnedQuantities, sale } from "./correction-records.ts";
import type { Db } from "./db/driver.ts";
import { DomainFault } from "./domain.ts";
import { historyData, revision } from "./history-queries.ts";
import { clock } from "./inventory-repo.ts";
import { settings } from "./trade-records.ts";
export function saleDetailData(db: Db, p: z.infer<typeof saleDetailParamsSchema>): SaleDetail {
  const current = revision(db, p.revision),
    original = sale(db, p.saleId);
  return {
    revision: current,
    sale: original,
    balance: saleBalance(db, original.id),
    initialPayment: original.initialPaymentId ? payment(db, original.initialPaymentId) : null,
    returned: [...returnedQuantities(db, original.id)].map(([lineId, qty]) => ({ lineId, qty })),
    payments: historyData(db, {
      kind: "payments",
      saleId: original.id,
      offset: p.paymentOffset,
      limit: 10,
      revision: current,
      query: "",
    }),
    returns: historyData(db, {
      kind: "returns",
      saleId: original.id,
      offset: p.returnOffset,
      limit: 10,
      revision: current,
      query: "",
    }),
  };
}
export function statementData(db: Db, p: z.infer<typeof statementParamsSchema>): Statement {
  const current = revision(db, p.revision),
    business = settings(db),
    bank = p.bankId ? (business.banks.find((b) => b.id === p.bankId) ?? null) : null;
  if (p.bankId && !bank) throw new DomainFault("E_BANK");
  const c = client(db, p.clientId),
    a = account(db, c.id, clock().date),
    { purchases: _purchases, ...summary } = a;
  const salesPage = historyData(db, {
    kind: "sales",
    clientId: c.id,
    offset: p.salesOffset,
    limit: 10,
    revision: current,
    query: "",
  });
  return {
    revision: current,
    client: c,
    business,
    bankSnapshot: bank,
    account: summary,
    today: clock().date,
    salesPage,
    sales: salesPage.rows.flatMap((row) => (row.kind === "sale" ? [sale(db, row.data.id)] : [])),
    payments: historyData(db, {
      kind: "payments",
      clientId: c.id,
      offset: p.paymentOffset,
      limit: 10,
      revision: current,
      query: "",
    }),
    returns: historyData(db, {
      kind: "returns",
      clientId: c.id,
      offset: p.returnOffset,
      limit: 10,
      revision: current,
      query: "",
    }),
  };
}
