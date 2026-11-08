import { Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { summarySchema } from "../shared/history-contracts.ts";
import { dateText, moneyText } from "./format.ts";
import { type Period, PeriodControls, periodRange } from "./PeriodControls.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import type { ScreenProps } from "./types.ts";
import { useQuery } from "./use-query.ts";
export function SummaryPage(props: ScreenProps) {
  const { t, i18n } = useTranslation(),
    [period, setPeriod] = useState<Period>("today"),
    [custom, setCustom] = useState({ from: props.data.today, to: props.data.today });
  const preset = periodRange(props.data.today, period),
    { from, to } =
      period === "all"
        ? custom
        : { from: preset.from ?? props.data.today, to: preset.to ?? props.data.today };
  const q = useQuery(props.read, "summary", { from, to }, summarySchema, props.data.revision),
    s = q.value;
  return (
    <section className="ventas-summary">
      <div className="ventas-section-title">
        <div>
          <h1 className="ventas-page-title">{t("nav.summary")}</h1>
          <p>
            {from && to ? `${dateText(from, i18n.language)} — ${dateText(to, i18n.language)}` : ""}
          </p>
        </div>
        <PeriodControls value={period} all={false} onChange={setPeriod} />
      </div>
      <div className="ventas-date-range">
        <Input
          label={t("fromDate")}
          type="date"
          value={from}
          onChange={(e) => {
            setCustom({ from: e.target.value, to });
            setPeriod("all");
          }}
        />
        <Input
          label={t("toDate")}
          type="date"
          value={to}
          onChange={(e) => {
            setCustom({ from, to: e.target.value });
            setPeriod("all");
          }}
        />
      </div>
      <QueryNotice issue={q.issue} loading={q.loading} retry={q.retry} />
      {s ? (
        <>
          <div className="ventas-summary-metrics">
            {(["revenue", "received", "balance", "profit"] as const).map((k) => (
              <div key={k}>
                <span>{t(`summaryMetrics.${k}`)}</span>
                <strong>{moneyText(s[k], i18n.language)}</strong>
              </div>
            ))}
          </div>
          <div className="ventas-summary-columns">
            <section>
              <h2>{t("salesCostsExpenses")}</h2>
              {(["revenue", "cogs", "expenses", "loss", "profit"] as const).map((k) => (
                <div className="ventas-event" key={k}>
                  <span>{t(`summaryMetrics.${k}`)}</span>
                  <strong>{moneyText(s[k], i18n.language)}</strong>
                </div>
              ))}
              <p>{t("profitExplanation")}</p>
            </section>
            <section>
              <h2>{t("moneyAndAccounts")}</h2>
              {(["cash", "transfer", "purchases", "withdrawals", "overdue"] as const).map((k) => (
                <div className="ventas-event" key={k}>
                  <span>{t(`summaryMetrics.${k}`)}</span>
                  <strong>{moneyText(s[k], i18n.language)}</strong>
                </div>
              ))}
            </section>
          </div>
          <h2>{t("bestSellers")}</h2>
          {s.top.length ? (
            s.top.map((p) => (
              <div className="ventas-event" key={p.productId}>
                <span>{p.name}</span>
                <strong>{t("pieceCount", { count: p.qty })}</strong>
              </div>
            ))
          ) : (
            <p>{t("emptyMovements")}</p>
          )}
        </>
      ) : null}
    </section>
  );
}
