import { useTranslation } from "react-i18next";
import type { PaymentInput } from "../shared/trading-contracts.ts";
import { moneyText } from "./format.ts";

export function DraftPaymentSummary({ total, payment }: { total: number; payment: PaymentInput }) {
  const { t, i18n } = useTranslation();
  const money = (n: number) =>
    Number.isSafeInteger(n) && n >= 0 ? moneyText(n, i18n.language) : "—";
  const amountValid =
    Number.isSafeInteger(payment.amount) && payment.amount >= 0 && payment.amount <= total;
  const receivedValid =
    Number.isSafeInteger(payment.received) && payment.received >= payment.amount;
  const pending = amountValid ? total - payment.amount : null;
  return (
    <>
      <dl className="ventas-paper-summary">
        <div>
          <dt className="ventas-paper-total-label">{t("total")}</dt>
          <dd>
            <strong>{money(total)}</strong>
          </dd>
        </div>
        <div>
          <dt>{t(payment.method)}</dt>
          <dd className="ventas-paper-amount">{money(payment.amount)}</dd>
        </div>
        <div>
          <dt>{t("pending")}</dt>
          <dd className="ventas-paper-amount">{pending === null ? "—" : money(pending)}</dd>
        </div>
        {payment.method === "cash" ? (
          <div>
            <dt>{t("change")}</dt>
            <dd className="ventas-paper-amount">
              {amountValid && receivedValid ? money(payment.received - payment.amount) : "—"}
            </dd>
          </div>
        ) : null}
      </dl>
      {!amountValid ||
      !receivedValid ||
      (payment.method === "transfer" && payment.received !== payment.amount) ? (
        <p>{t("draftPaymentInvalid")}</p>
      ) : null}
    </>
  );
}
