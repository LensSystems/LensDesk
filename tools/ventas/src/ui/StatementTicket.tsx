import { useTranslation } from "react-i18next";
import type { Statement } from "../shared/history-contracts.ts";
import { BankDetails } from "./BankDetails.tsx";
import { dateText, moneyText } from "./format.ts";
import { ReturnDetailButton } from "./ReturnDetailButton.tsx";
import { StatementRows } from "./StatementRows.tsx";
import type { ReadQuery } from "./types.ts";
export function StatementTicket({ statement: s, read }: { statement: Statement; read: ReadQuery }) {
  const { t, i18n } = useTranslation(),
    money = (n: number) => moneyText(n, i18n.language);
  return (
    <article className="ventas-paper" aria-label={t("statement")}>
      <header>
        <h3>{s.business.name || t("unconfiguredBusiness")}</h3>
        <p>{s.business.address}</p>
        <p>{s.business.phone}</p>
        <h2>{t("statement")}</h2>
      </header>
      <p>{t("statementGenerated", { date: dateText(s.today, i18n.language) })}</p>
      <p>
        {t("client")}: {s.client.name}
      </p>
      <p>{t("statementPageNotice")}</p>
      <table>
        <thead>
          <tr>
            {["product", "quantity", "price", "amount"].map((k) => (
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
          <p className="ventas-paper-event" key={row.data.id}>
            <span>
              {dateText(row.data.date, i18n.language)} · {t(row.data.method)}
              {row.data.reversal ? ` · ${t("reversedPayment")}` : ""}
            </span>
            <strong>{money(row.data.amount)}</strong>
          </p>
        ) : null,
      )}
      <h3>{t("returns")}</h3>
      {s.returns.rows.map((row) =>
        row.kind === "return" ? (
          <div key={row.data.id}>
            {dateText(row.data.date, i18n.language)} · {row.data.reason}
            <br />
            {t("returnAmount")}: {money(row.data.amount)} · {t("refund")}: {money(row.data.refund)}
            <ReturnDetailButton returnId={row.data.id} read={read} revision={s.revision} />
          </div>
        ) : null,
      )}
      <dl className="ventas-confirm-summary">
        <div>
          <dt>{t("accountBalance")}</dt>
          <dd>
            <strong>{money(s.account.balance)}</strong>
          </dd>
        </div>
        <div>
          <dt>{t("overdue")}</dt>
          <dd>{money(s.account.overdue)}</dd>
        </div>
      </dl>
      <BankDetails bank={s.bankSnapshot} />
      <footer>{s.business.thanks || t("historicalThanksUnavailable")}</footer>
    </article>
  );
}
