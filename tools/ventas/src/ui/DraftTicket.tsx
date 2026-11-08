import { useTranslation } from "react-i18next";
import type { PaymentInput } from "../shared/trading-contracts.ts";
import { BankDetails } from "./BankDetails.tsx";
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
    <article className="ventas-paper" aria-label={t("draftTicket")}>
      <header>
        <h3>{business.name || t("unconfiguredBusiness")}</h3>
        <p>{business.address}</p>
        <h2>{t("draftTicket")}</h2>
      </header>
      <p>
        {dateText(data.today, i18n.language)} · {client?.name ?? t("counter")}
      </p>
      <table>
        <thead>
          <tr>
            {["product", "quantity", "price", "amount"].map((k) => (
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
      <strong>
        {t("saleTotal")}: {moneyText(total, i18n.language)}
      </strong>
      <p>
        {t("appliedPayment")}:{" "}
        {Number.isFinite(payment.amount) ? moneyText(payment.amount, i18n.language) : "—"}
      </p>
      {payment.method === "transfer" ? (
        <BankDetails bank={data.settings.banks.find((b) => b.id === payment.bankId) ?? null} />
      ) : null}
      <footer>{business.thanks || t("historicalThanksUnavailable")}</footer>
      <p>{t("draftNotConfirmed")}</p>
    </article>
  );
}
