import { useTranslation } from "react-i18next";
import type { Summary } from "../shared/history-contracts.ts";
import { moneyText } from "./format.ts";
export function SummaryPanels({ summary }: { summary: Summary }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="ventas-summary-top">
      <section className="ventas-summary-panel">
        <h2>{t("salesCostsExpenses")}</h2>
        {(["revenue", "cogs", "expenses", "loss", "profit"] as const).map((k) => (
          <div className="ventas-summary-event" key={k}>
            <span>{t(`summaryPanelMetrics.${k}`)}</span>
            <b>{moneyText(summary[k], i18n.language)}</b>
          </div>
        ))}
        <p>{t("summaryInventoryExplanation")}</p>
      </section>
      <section className="ventas-summary-panel">
        <h2>{t("moneyAndAccounts")}</h2>
        {(["cash", "transfer", "purchases", "withdrawals", "overdue"] as const).map((k) => (
          <div className="ventas-summary-event" key={k}>
            <span>{t(`summaryPanelMetrics.${k}`)}</span>
            <b>{moneyText(summary[k], i18n.language)}</b>
          </div>
        ))}
      </section>
    </div>
  );
}
