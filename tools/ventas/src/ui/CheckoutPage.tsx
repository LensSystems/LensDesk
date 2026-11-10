import { Button, Notice } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { moneyText } from "./format.ts";
import { PaymentFields, type PaymentForm, paymentValue } from "./PaymentFields.tsx";
import type { ScreenProps } from "./types.ts";

export function CheckoutPage({
  total,
  value,
  onChange,
  onBack,
  onConfirm,
  ...props
}: ScreenProps & {
  total: number;
  value: PaymentForm;
  onChange: (value: PaymentForm) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { t, i18n } = useTranslation();
  const payment = paymentValue(value, true);
  const client = props.data.clients.find((c) => c.id === props.data.draft.clientId);
  const valid =
    Number.isSafeInteger(payment.amount) &&
    Number.isSafeInteger(payment.received) &&
    payment.amount >= 0 &&
    payment.amount <= total &&
    (!client || client.active) &&
    (client || payment.amount === total) &&
    (!payment.amount ||
      (payment.method === "cash"
        ? Boolean(props.data.cash) && payment.received >= payment.amount
        : payment.received === payment.amount &&
          props.data.settings.banks.some((b) => b.id === payment.bankId)));
  return (
    <>
      <div className="ventas-checkout-total">
        <span>{t("total")}</span>
        <strong>{moneyText(total, i18n.language)}</strong>
      </div>
      <PaymentFields
        variant="checkout"
        value={value}
        onChange={onChange}
        banks={props.data.settings.banks}
        received
        disabled={props.busy}
      />
      {payment.method === "cash" && !props.data.cash ? (
        <Notice tone="warning" title={t("errors.E_CASH_CLOSED")} />
      ) : null}
      <div className="ventas-checkout-balance">
        <p>
          <span>{t("pendingThisSale")}</span>
          <strong>
            {Number.isFinite(payment.amount)
              ? moneyText(Math.max(0, total - payment.amount), i18n.language)
              : "—"}
          </strong>
        </p>
        {payment.method === "cash" ? (
          <p>
            <span>{t("change")}</span>
            <strong>
              {Number.isFinite(payment.received) && Number.isFinite(payment.amount)
                ? moneyText(Math.max(0, payment.received - payment.amount), i18n.language)
                : "—"}
            </strong>
          </p>
        ) : null}
      </div>
      <p className="ventas-checkout-note">{t("partialPaymentHint")}</p>
      <div className="ventas-checkout-actions">
        <Button
          data-checkout-confirm
          variant="primary"
          disabled={!valid || props.busy}
          onClick={onConfirm}
        >
          {t("confirmSale")}
        </Button>
        <Button onClick={onBack} disabled={props.operation.writing}>
          {t("backToSale")}
        </Button>
      </div>
    </>
  );
}
