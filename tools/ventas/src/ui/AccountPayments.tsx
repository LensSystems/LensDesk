import { Button } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { historyPageSchema } from "../shared/history-contracts.ts";
import { AccountAllocations } from "./AccountAllocations.tsx";
import { dateText, moneyText, saleFolio } from "./format.ts";
import { Pager } from "./Pager.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import type { ScreenProps } from "./types.ts";
import { useOffset } from "./use-offset.ts";
import { useQuery } from "./use-query.ts";
export function AccountPayments({
  clientId,
  onReverse,
  ...props
}: ScreenProps & { clientId: string; onReverse: (id: string) => void }) {
  const { t, i18n } = useTranslation(),
    [offset, setOffset] = useOffset(JSON.stringify([clientId, props.data.revision]));
  const q = useQuery(
    props.read,
    "history",
    { kind: "payments", clientId, offset, limit: 20, revision: props.data.revision },
    historyPageSchema,
  );
  return (
    <section className="ventas-account-panel ventas-account-payments">
      <h2>{t("accountPayments")}</h2>
      <QueryNotice issue={q.issue} loading={q.loading} retry={q.retry} />
      {q.value?.rows.map((row) =>
        row.kind === "payment" ? (
          <div className="ventas-account-event" key={row.data.id}>
            <div>
              <b>
                {row.data.legacyFolio ?? t("paymentFolio", { folio: row.data.folio })} ·{" "}
                {t(row.data.method)}
              </b>
              <small>
                {dateText(row.data.date, i18n.language)}
                {row.data.allocationPage?.rows.length && row.data.allocationPage.total <= 50
                  ? ` · ${row.data.allocationPage.rows.map((a) => `${saleFolio(a)}: ${moneyText(a.amount, i18n.language)}${a.historyMissing?.length ? ` · ${t("historicalUnavailable")}` : ""}`).join(" / ")}`
                  : ""}
                {row.data.reversalId ? ` · ${t("reversedPayment")}` : ""}
                {row.data.opening ? ` · ${t("openingPayment")}` : ""}
              </small>
              {row.data.allocationPage && row.data.allocationPage.total > 50 ? (
                <AccountAllocations payment={row.data} read={props.read} data={props.data} />
              ) : null}
              {row.data.reversal ? (
                <small>
                  {dateText(row.data.reversal.date, i18n.language)} · {row.data.reversal.reason}
                </small>
              ) : null}
            </div>
            <div>
              <b>{moneyText(row.data.amount, i18n.language)}</b>
              {!row.data.reversalId && !row.data.opening ? (
                <>
                  <br />
                  <Button variant="ghost" onClick={() => onReverse(row.data.id)}>
                    {t("reversePayment")}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : null,
      )}
      {q.value && !q.value.rows.length ? <p>{t("noAccountPayments")}</p> : null}
      <Pager page={q.value} offset={offset} limit={20} loading={q.loading} onPage={setOffset} />
    </section>
  );
}
