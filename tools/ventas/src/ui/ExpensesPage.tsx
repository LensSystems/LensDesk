import { Button } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CashDialog } from "./CashDialog.tsx";
import { dateText, moneyText } from "./format.ts";
import { OutflowDialog } from "./OutflowDialog.tsx";
import type { ScreenProps } from "./types.ts";
export function ExpensesPage(props: ScreenProps) {
  const { data } = props,
    { t, i18n } = useTranslation();
  const [dialog, setDialog] = useState<"cash" | "expense" | "withdrawal" | null>(null);
  return (
    <section className="ventas-inventory">
      <div className="ventas-section-title">
        <h1>{t("nav.expenses")}</h1>
        <div className="ventas-row-actions">
          <Button onClick={() => setDialog("expense")}>{t("recordExpense")}</Button>
          <Button onClick={() => setDialog("withdrawal")}>{t("recordWithdrawal")}</Button>
        </div>
      </div>
      <section className="ventas-cash-panel">
        <div className="ventas-section-title">
          <h2>{t(data.cash ? "cashOpen" : "cashClosed")}</h2>
          <Button disabled={props.busy} onClick={() => setDialog("cash")}>
            {t(data.cash ? "closeCash" : "openCash")}
          </Button>
        </div>
        {data.cash ? (
          <div className="ventas-metrics">
            {(["initial", "ins", "purchases", "expenses", "withdrawals", "expected"] as const).map(
              (key) => (
                <div key={key}>
                  <span>{t(`cashMetrics.${key}`)}</span>
                  <strong>{moneyText(data.cash?.[key] ?? 0, i18n.language)}</strong>
                </div>
              ),
            )}
          </div>
        ) : (
          <p>{t("openCashIntro")}</p>
        )}
      </section>
      <h2>{t("outflows")}</h2>
      <div className="ventas-table-wrap">
        <table>
          <thead>
            <tr>
              {["date", "movement", "concept", "paymentMethod", "amount"].map((k) => (
                <th key={k}>{t(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.outflows.map((o) => (
              <tr key={o.id}>
                <td>{dateText(o.date, i18n.language)}</td>
                <td>{t(o.kind)}</td>
                <th scope="row">
                  {o.concept}
                  <small className="block">{o.category}</small>
                  {o.reference ? (
                    <small className="block">
                      {t("referenceLabel")}: {o.reference}
                    </small>
                  ) : null}
                </th>
                <td>{t(o.method)}</td>
                <td>{moneyText(o.amount, i18n.language)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.outflows.length ? <p>{t("emptyMovements")}</p> : null}
      <h2>{t("inventoryPurchases")}</h2>
      <p>{t("purchasesSeparate")}</p>
      {data.purchases.map((p) => (
        <div className="ventas-event" key={p.id}>
          <span>
            {dateText(p.date, i18n.language)} ·{" "}
            {data.products.find((x) => x.id === p.productId)?.name} · {t(p.method)}
          </span>
          <strong>{moneyText(p.cost, i18n.language)}</strong>
        </div>
      ))}
      <h2>{t("cashClosings")}</h2>
      {data.closings.map((c) => (
        <div className="ventas-event" key={c.id}>
          <span>
            {dateText(c.closedDate, i18n.language)} · {c.reason || t("noDifference")}
          </span>
          <span>
            {t("countedCash")}: {moneyText(c.counted, i18n.language)} · {t("difference")}:{" "}
            {moneyText(c.difference, i18n.language)}
          </span>
        </div>
      ))}
      {dialog === "cash" ? <CashDialog {...props} close={() => setDialog(null)} /> : null}
      {dialog === "expense" || dialog === "withdrawal" ? (
        <OutflowDialog {...props} kind={dialog} close={() => setDialog(null)} />
      ) : null}
    </section>
  );
}
