import { useTranslation } from "react-i18next";
import type { Statement } from "../shared/history-contracts.ts";
import { BankDetails } from "./BankDetails.tsx";
import { dateText, moneyText, saleFolio } from "./format.ts";
import { ReturnDetailButton } from "./ReturnDetailButton.tsx";
import { StatementRows } from "./StatementRows.tsx";
import type { ReadQuery } from "./types.ts";
export function StatementTicket({ statement: s, read }: { statement: Statement; read: ReadQuery }) {
  const { t, i18n } = useTranslation(),
    money = (n: number) => moneyText(n, i18n.language);
  return (
    <>
      <article data-theme="light" className="ventas-paper" aria-label={t("statement")}>
        <header>
          <h3>{s.business.name || t("unconfiguredBusiness")}</h3>
          <p>{s.business.address}</p>
          {s.business.rfc ? (
            <p>
              {t("rfc")}: {s.business.rfc}
            </p>
          ) : null}
          <p>{s.business.phone}</p>
          <div className="ventas-paper-line" />
          <h2>{t("statement")}</h2>
        </header>
        <p>
          {t("date")}: {dateText(s.today, i18n.language)}
        </p>
        <p>
          {t("client")}: {s.client.name}
          {!s.client.active ? ` · ${t("inactive")}` : ""}
        </p>
        <div className="ventas-paper-line" />
        <table>
          <thead>
            <tr>
              {["paperStatementProduct", "paperQuantity", "price", "paperAmount"].map((k) => (
                <th key={k}>{t(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.sales.map((sale) => (
              <StatementRows
                key={sale.id}
                sale={sale}
                summary={s.salesPage.rows.find(
                  (row) => row.kind === "sale" && row.data.id === sale.id,
                )}
              />
            ))}
          </tbody>
        </table>
        <h3>{t("payments")}</h3>
        {s.payments.rows.map((row) =>
          row.kind === "payment" ? (
            <div key={row.data.id}>
              <p className="ventas-paper-event">
                <span>
                  {dateText(row.data.date, i18n.language)} · {t(row.data.method)}
                  {row.data.reversal ? ` · ${t("reversedPayment")}` : ""}
                </span>
                <strong>{row.data.reversalId ? money(0) : `−${money(row.data.amount)}`}</strong>
              </p>
              {row.data.opening ? <p>{t("openingPayment")}</p> : null}
              {row.data.reversal ? (
                <p>
                  {dateText(row.data.reversal.date, i18n.language)} · {row.data.reversal.reason} ·{" "}
                  {t("originalTotal")}: {money(row.data.amount)}
                </p>
              ) : null}
              {row.data.allocationPage?.rows.map((a) => (
                <p key={a.saleId}>
                  {saleFolio(a)}: {money(a.amount)}
                </p>
              ))}
              {row.data.allocationPage?.nextOffset !== null &&
              row.data.allocationPage?.nextOffset !== undefined ? (
                <p>{t("statementAllocationNotice")}</p>
              ) : null}
            </div>
          ) : null,
        )}
        <h3>{t("returns")}</h3>
        {s.returns.rows.map((row) =>
          row.kind === "return" ? (
            <div key={row.data.id}>
              {dateText(row.data.date, i18n.language)} · {row.data.reason}
              <br />
              {t("returnAmount")}: {money(row.data.amount)} · {t("refund")}:{" "}
              {money(row.data.refund)}
            </div>
          ) : null,
        )}
        <dl className="ventas-paper-summary">
          <div>
            <dt>{t("accountBalance")}</dt>
            <dd>
              <strong>{money(s.account.balance)}</strong>
            </dd>
          </div>
        </dl>
        <BankDetails bank={s.bankSnapshot} />
        {s.business.cashier ? (
          <p>
            {t("servedBy")}: {s.business.cashier}
          </p>
        ) : null}
        <footer>{s.business.thanks || t("historicalThanksUnavailable")}</footer>
      </article>
      {s.returns.rows.map((row) =>
        row.kind === "return" ? (
          <ReturnDetailButton
            key={row.data.id}
            returnId={row.data.id}
            read={read}
            revision={s.revision}
          />
        ) : null,
      )}
    </>
  );
}
