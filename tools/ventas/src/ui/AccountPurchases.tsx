import { Button } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { historyPageSchema } from "../shared/history-contracts.ts";
import { dateText, moneyText, saleFolio } from "./format.ts";
import { Pager } from "./Pager.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import type { ScreenProps } from "./types.ts";
import { useOffset } from "./use-offset.ts";
import { useQuery } from "./use-query.ts";
export function AccountPurchases({
  clientId,
  onSale,
  ...props
}: ScreenProps & { clientId: string; onSale: (id: string) => void }) {
  const { t, i18n } = useTranslation(),
    [offset, setOffset] = useOffset(JSON.stringify([clientId, props.data.revision]));
  const q = useQuery(
    props.read,
    "history",
    { kind: "sales", clientId, offset, limit: 20, revision: props.data.revision },
    historyPageSchema,
  );
  return (
    <section className="ventas-account-panel">
      <div className="ventas-account-heading">
        <h2>{t("purchasesAndDue")}</h2>
        <span>{t("purchaseTermsPreserved")}</span>
      </div>
      <QueryNotice issue={q.issue} loading={q.loading} retry={q.retry} />
      <div className="ventas-account-table-wrap">
        <table className="ventas-account-table">
          <thead>
            <tr>
              {[
                "accountPurchase",
                "accountDueHeading",
                "netAmount",
                "netPaid",
                "pending",
                "actions",
              ].map((k) => (
                <th key={k} scope="col">
                  <span className={k === "actions" ? "sr-only" : undefined}>{t(k)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.value?.rows.map((row) =>
              row.kind === "sale" ? (
                <tr key={row.data.id}>
                  <td>
                    <b>{saleFolio(row.data)}</b>
                    <br />
                    <small>
                      {dateText(row.data.date, i18n.language)}
                      {row.data.opening ? ` · ${t("priorBalance")}` : ""}
                    </small>
                  </td>
                  <td>{dateText(row.data.due, i18n.language)}</td>
                  {(["net", "paid", "pending"] as const).map((key) => (
                    <td key={key}>{moneyText(row.data[key], i18n.language)}</td>
                  ))}
                  <td>
                    <Button variant="ghost" onClick={() => onSale(row.data.id)}>
                      {t("viewDetail")}
                    </Button>
                  </td>
                </tr>
              ) : null,
            )}
            {q.value && !q.value.rows.length ? (
              <tr>
                <td colSpan={6}>{t("noAccountPurchases")}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={q.value} offset={offset} limit={20} loading={q.loading} onPage={setOffset} />
    </section>
  );
}
