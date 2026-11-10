import { useTranslation } from "react-i18next";
import type { SaleDetail } from "../shared/history-contracts.ts";
import { BankDetails } from "./BankDetails.tsx";
import { dateText, moneyText, saleFolio } from "./format.ts";
export function SaleTicket({ detail }: { detail: SaleDetail }) {
  const { t, i18n } = useTranslation(),
    s = detail.sale,
    money = (value: number) => moneyText(value, i18n.language);
  return (
    <article data-theme="light" className="ventas-paper" aria-label={t("saleTicket")}>
      <header>
        <h3>
          {s.historyMissing?.includes("business")
            ? t("historicalUnavailable")
            : s.business.name || t("unconfiguredBusiness")}
        </h3>
        <p>{s.business.address}</p>
        {s.business.rfc ? (
          <p>
            {t("rfc")}: {s.business.rfc}
          </p>
        ) : null}
        <p>{s.business.phone}</p>
        <div className="ventas-paper-line" />
        <h2>{t(s.opening ? "openingBalance" : "saleTicket")}</h2>
      </header>
      <p>
        {t("folio")}: {saleFolio(s)}
      </p>
      <p>
        {t("date")}: {dateText(s.date, i18n.language)}
      </p>
      <p>
        {t("client")}:{" "}
        {s.clientId ? (s.clientSnapshot?.name ?? t("historicalUnavailable")) : t("counter")}
      </p>
      {s.opening ? (
        <p>{s.note}</p>
      ) : (
        <>
          <div className="ventas-paper-line" />
          <table>
            <thead>
              <tr>
                {["product", "paperQuantity", "price", "paperAmount"].map((k) => (
                  <th key={k}>{t(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.lines.map((l) => (
                <tr key={l.id}>
                  <th scope="row">{l.name}</th>
                  <td>{l.qty}</td>
                  <td>{money(l.price)}</td>
                  <td>{money(l.price * l.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <dl className="ventas-paper-summary">
        <div>
          <dt className="ventas-paper-total-label">{t("originalTotal")}</dt>
          <dd>
            <strong>{money(s.total)}</strong>
          </dd>
        </div>
        <div>
          <dt>{t("netAfterReturns")}</dt>
          <dd className="ventas-paper-amount">{money(detail.balance.total)}</dd>
        </div>
        <div>
          <dt>{t("netPaid")}</dt>
          <dd className="ventas-paper-amount">{money(detail.balance.paid)}</dd>
        </div>
        <div>
          <dt>{t("pending")}</dt>
          <dd className="ventas-paper-amount">{money(detail.balance.pending)}</dd>
        </div>
        <div>
          <dt>{t("receivedAtSale")}</dt>
          <dd className="ventas-paper-amount">
            {s.historyMissing?.includes("received")
              ? t("historicalUnavailable")
              : money(s.received)}
          </dd>
        </div>
        <div>
          <dt>{t("changeAtSale")}</dt>
          <dd className="ventas-paper-amount">
            {s.historyMissing?.includes("change") ? t("historicalUnavailable") : money(s.change)}
          </dd>
        </div>
      </dl>
      {s.exception ? (
        <p>
          {t("exceptionReason")}: {s.exception}
        </p>
      ) : null}
      {detail.initialPayment?.method === "transfer" ? (
        <BankDetails bank={detail.initialPayment.bankSnapshot} />
      ) : null}
      {(s.received > 0 || s.historyMissing?.includes("initialPayment")) &&
      !detail.initialPayment ? (
        <p>{t("historicalPaymentUnavailable")}</p>
      ) : null}
      {s.business.cashier ? (
        <p>
          {t("servedBy")}: {s.business.cashier}
        </p>
      ) : null}
      <footer>{s.business.thanks || t("historicalThanksUnavailable")}</footer>
      <small>{t("ticketOriginalPreserved")}</small>
    </article>
  );
}
