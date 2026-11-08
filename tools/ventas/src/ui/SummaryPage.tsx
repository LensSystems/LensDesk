import { useState } from "react";
import { useTranslation } from "react-i18next";
import { summarySchema } from "../shared/history-contracts.ts";
import { dateText, moneyText } from "./format.ts";
import { type Period, PeriodControls, periodRange } from "./PeriodControls.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import { SummaryAccounts } from "./SummaryAccounts.tsx";
import { SummaryPanels } from "./SummaryPanels.tsx";
import type { ScreenProps } from "./types.ts";
import { useQuery } from "./use-query.ts";
export function SummaryPage({
  period: controlledPeriod,
  onPeriod,
  onAccount = () => {},
  ...props
}: ScreenProps & {
  period?: Period;
  onPeriod?: (value: Period) => void;
  onAccount?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation(),
    [localPeriod, setLocalPeriod] = useState<Period>("today"),
    period = controlledPeriod ?? localPeriod;
  const range = periodRange(props.data.today, period),
    from = range.from ?? props.data.today,
    to = range.to ?? props.data.today;
  const q = useQuery(props.read, "summary", { from, to }, summarySchema, props.data.revision),
    s = q.value;
  return (
    <section className="ventas-summary-workspace">
      <div className="ventas-summary-heading">
        <div>
          <h1 className="ventas-page-title">{t("nav.summary")}</h1>
          <p>
            {t("summaryDateCaption", {
              from: dateText(from, i18n.language),
              to: dateText(to, i18n.language),
            })}
          </p>
        </div>
        <PeriodControls
          value={period}
          all={false}
          segmented
          onChange={onPeriod ?? setLocalPeriod}
        />
      </div>
      <QueryNotice issue={q.issue} loading={q.loading} retry={q.retry} />
      {s ? (
        <>
          <div className="ventas-summary-cards">
            {(["revenue", "received", "balance", "profit"] as const).map((k) => (
              <div className="ventas-summary-panel ventas-summary-metric" key={k}>
                <span>{t(`summaryMetrics.${k}`)}</span>
                <b>{moneyText(s[k], i18n.language)}</b>
                <small>{t(`summarySubtitles.${k}`, { count: s.count })}</small>
              </div>
            ))}
          </div>
          <SummaryPanels summary={s} />
          <div className="ventas-summary-bottom">
            <section className="ventas-summary-panel">
              <h2>{t("bestSellers")}</h2>
              {s.top.map((p) => (
                <div key={p.productId}>
                  <div className="ventas-summary-product">
                    <b>
                      {props.data.products.find((product) => product.id === p.productId)?.name ??
                        p.name}
                    </b>
                    <small>{t("netPieces", { count: p.qty })}</small>
                  </div>
                  <div className="ventas-summary-bar">
                    <span style={{ width: `${(p.qty / (s.top[0]?.qty || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
              {!s.top.length ? <p>{t("noSummarySales")}</p> : null}
            </section>
            <SummaryAccounts data={props.data} onAccount={onAccount} />
          </div>
        </>
      ) : null}
    </section>
  );
}
