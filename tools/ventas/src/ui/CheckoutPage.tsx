import { Button, Notice } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmSaleDialog } from "./ConfirmSaleDialog.tsx";
import { moneyText } from "./format.ts";
import { newPayment, PaymentFields, paymentValue } from "./PaymentFields.tsx";
import type { ScreenProps } from "./types.ts";
export function CheckoutPage({
  total,
  onBack,
  ...props
}: ScreenProps & { total: number; onBack: () => void }) {
  const { t, i18n } = useTranslation(),
    [value, setValue] = useState(() => newPayment(total)),
    [confirm, setConfirm] = useState(false);
  const payment = paymentValue(value, true),
    client = props.data.clients.find((c) => c.id === props.data.draft.clientId);
  const valid =
    Number.isSafeInteger(payment.amount) &&
    Number.isSafeInteger(payment.received) &&
    payment.amount >= 0 &&
    payment.amount <= total &&
    (client || payment.amount === total) &&
    (!payment.amount ||
      (payment.method === "cash"
        ? Boolean(props.data.cash) && payment.received >= payment.amount
        : payment.received === payment.amount && Boolean(payment.bankId)));
  return (
    <section className="ventas-checkout">
      <div className="ventas-checkout-form">
        <h1>{t("checkout")}</h1>
        <p>{client?.name ?? t("counter")}</p>
        <strong className="ventas-sale-total">{moneyText(total, i18n.language)}</strong>
        <PaymentFields
          value={value}
          onChange={setValue}
          banks={props.data.settings.banks}
          received
          disabled={props.busy}
        />
        {payment.method === "cash" && !props.data.cash ? (
          <Notice tone="warning" title={t("errors.E_CASH_CLOSED")} />
        ) : null}
        <p>
          {t("pendingThisSale")}:{" "}
          {Number.isFinite(payment.amount)
            ? moneyText(Math.max(0, total - payment.amount), i18n.language)
            : "—"}
        </p>
        {payment.method === "cash" ? (
          <p>
            {t("change")}:{" "}
            {Number.isFinite(payment.received) && Number.isFinite(payment.amount)
              ? moneyText(Math.max(0, payment.received - payment.amount), i18n.language)
              : "—"}
          </p>
        ) : null}
        <div className="ventas-parallel-actions">
          <Button
            size="lg"
            variant="primary"
            disabled={!valid || props.busy}
            onClick={() => setConfirm(true)}
          >
            {t("confirmSale")}
          </Button>
          <Button size="lg" onClick={onBack} disabled={props.operation.writing}>
            {t("backToSale")}
          </Button>
        </div>
      </div>
      <div className="ventas-checkout-review">
        <h2>{t("reviewProducts")}</h2>
        {props.data.draft.lines.map((l) => {
          const p = props.data.products.find((p) => p.id === l.productId);
          return (
            <div className="ventas-event" key={l.productId}>
              <span>
                {p?.name} × {l.qty}
              </span>
              <strong>{moneyText((p?.price ?? 0) * l.qty, i18n.language)}</strong>
            </div>
          );
        })}
        <p>{t("confirmSaleIntro")}</p>
      </div>
      {confirm ? (
        <ConfirmSaleDialog
          {...props}
          total={total}
          payment={payment}
          close={() => setConfirm(false)}
          onSaved={onBack}
        />
      ) : null}
    </section>
  );
}
