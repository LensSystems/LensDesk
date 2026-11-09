import { useTranslation } from "react-i18next";
import type { PaymentInput } from "../shared/trading-contracts.ts";
import { BankDetails } from "./BankDetails.tsx";
import { DraftPaymentSummary } from "./DraftPaymentSummary.tsx";
import { dateText, moneyText } from "./format.ts";
import type { ScreenProps } from "./types.ts";
export function DraftTicket({
  total,
  payment,
  ...props
}: ScreenProps & { total: number; payment: PaymentInput }) {
  const { t, i18n } = useTranslation(),
    { data } = props,
    client = data.clients.find((c) => c.id === data.draft.clientId),
    business = data.settings;
  return (
    <article data-theme="light" className="ventas-paper" aria-label={t("draftTicket")}>
      <header>
        <h3>{business.name || t("unconfiguredBusiness")}</h3>
        <p>{business.address}</p>
        <p>{business.phone}</p>
        {business.rfc ? (
          <p>
            {t("rfc")}: {business.rfc}
          </p>
        ) : null}
        <div className="ventas-paper-line" />
        <h2>{t("draftTicket")}</h2>
      </header>
      <p>
        {t("date")}: {dateText(data.today, i18n.language)}
        <br />
        {t("client")}: {client?.name ?? t("counter")}
      </p>
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
          {data.draft.lines.map((l) => {
            const p = data.products.find((p) => p.id === l.productId);
            return (
              <tr key={l.productId}>
                <th scope="row">{p?.name}</th>
                <td>{l.qty}</td>
                <td>{moneyText(p?.price ?? 0, i18n.language)}</td>
                <td>{moneyText((p?.price ?? 0) * l.qty, i18n.language)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <DraftPaymentSummary total={total} payment={payment} today={data.today} term={client?.term} />
      {payment.method === "transfer" ? (
        <BankDetails bank={data.settings.banks.find((b) => b.id === payment.bankId) ?? null} />
      ) : null}
      <footer>{business.thanks || t("historicalThanksUnavailable")}</footer>
      <p className="ventas-paper-draft-note">{t("draftNotConfirmed")}</p>
    </article>
  );
}
