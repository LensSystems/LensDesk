import { useTranslation } from "react-i18next";
import type { Snapshot } from "../shared/contracts.ts";
import { dateText, moneyText } from "./format.ts";
export function RecentMovements({ data }: { data: Snapshot }) {
  const { t, i18n } = useTranslation();
  const products = new Map(data.products.map((p) => [p.id, p]));
  const rows = [
    ...data.outflows.map((o) => ({
      key: `outflow:${o.id}`,
      at: o.at,
      date: o.date,
      concept: o.concept,
      kind: t(o.kind),
      category: o.category,
      method: o.method,
      amount: o.amount,
      reference: o.reference,
    })),
    ...data.purchases.map((p) => ({
      key: `purchase:${p.id}`,
      at: p.at,
      date: p.date,
      concept: products.get(p.productId)?.name ?? t("product"),
      kind: t("inventoryPurchases"),
      category: t("nav.inventory"),
      method: p.method,
      amount: p.cost,
      reference: "",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
  return (
    <>
      <div className="ventas-section-title">
        <h2>{t("recentMovements")}</h2>
        <span className="text-muted">{t("purchasesExpensesWithdrawals")}</span>
      </div>
      <p className="text-muted">{t("recentMovementsLimit")}</p>
      {rows.length ? (
        rows.map((row) => (
          <article className="ventas-expense-panel ventas-recent-movement" key={row.key}>
            <div>
              <strong>{row.concept}</strong>
              <p className="text-muted">
                {row.kind}
                {row.category ? ` · ${row.category}` : ""} · {t(row.method)} ·{" "}
                <time dateTime={row.date}>{dateText(row.date, i18n.language)}</time>
              </p>
              {row.reference ? (
                <small>
                  {t("referenceLabel")}: {row.reference}
                </small>
              ) : null}
            </div>
            <strong>−{moneyText(row.amount, i18n.language)}</strong>
          </article>
        ))
      ) : (
        <p className="ventas-empty">{t("emptyMovements")}</p>
      )}
    </>
  );
}
