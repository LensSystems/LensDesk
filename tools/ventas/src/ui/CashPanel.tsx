import { Button, DialogTrigger } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { Snapshot } from "../shared/contracts.ts";
import { dateText, moneyText } from "./format.ts";
export function CashPanel({ data, busy }: { data: Snapshot; busy: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <section className="ventas-expense-panel">
        <div className="ventas-section-title">
          <h2>{t("cashTitle")}</h2>
          <span className={`ventas-stock-status${data.cash ? " ventas-cash-open" : ""}`}>
            {t(data.cash ? "cashStateOpen" : "cashStateClosed")}
          </span>
        </div>
        {data.cash ? (
          <>
            <div className="ventas-cash-lines">
              {(["initial", "ins", "outs", "expected"] as const).map((key) => (
                <div className="ventas-event" key={key}>
                  {key === "expected" ? (
                    <strong>{t(`cashMetrics.${key}`)}</strong>
                  ) : (
                    <span>{t(`cashMetrics.${key}`)}</span>
                  )}
                  <strong>{moneyText(data.cash?.[key] ?? 0, i18n.language)}</strong>
                </div>
              ))}
            </div>
            <details>
              <summary>{t("cashBreakdown")}</summary>
              {(["purchases", "expenses", "withdrawals", "refunds", "reversals"] as const).map(
                (key) => (
                  <div className="ventas-event" key={key}>
                    <span>{t(`cashMetrics.${key}`)}</span>
                    <strong>{moneyText(data.cash?.[key] ?? 0, i18n.language)}</strong>
                  </div>
                ),
              )}
            </details>
          </>
        ) : null}
        <DialogTrigger asChild>
          <Button data-cash-dialog-trigger="panel" variant="primary" disabled={busy}>
            {t(data.cash ? "closeCash" : "openCash")}
          </Button>
        </DialogTrigger>
        <p className="text-muted">{t("cashTransferNotice")}</p>
      </section>
      {data.closings.length ? (
        <section className="ventas-expense-panel">
          <h2>{t("cashClosings")}</h2>
          {data.closings.map((c) => (
            <div className="ventas-event" key={c.id}>
              <span>
                <strong className="ventas-closing-id">{c.id}</strong>
                <small className="block text-muted">
                  {dateText(c.closedDate, i18n.language)} · {c.reason || t("noDifference")}
                </small>
              </span>
              <span>
                <strong>{moneyText(c.counted, i18n.language)}</strong>
                <small className="block text-muted">
                  {t("difference")}: {moneyText(c.difference, i18n.language)}
                </small>
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
