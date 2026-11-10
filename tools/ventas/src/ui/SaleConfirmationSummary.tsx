import { useTranslation } from "react-i18next";
import { addDays } from "../shared/calendar.ts";
import type { PaymentInput } from "../shared/trading-contracts.ts";
import { dateText, moneyText } from "./format.ts";
import type { ScreenProps } from "./types.ts";

export function SaleConfirmationSummary({
  total,
  credit,
  payment,
  ...props
}: ScreenProps & { total: number; payment: PaymentInput; credit: boolean }) {
  const { t, i18n } = useTranslation();
  const client = props.data.clients.find((c) => c.id === props.data.draft.clientId);
  const account = props.data.accounts.find((a) => a.clientId === client?.id);
  const money = (value: number) => moneyText(value, i18n.language);
  const rows: [string, string | number][] =
    credit && client
      ? [
          [t("client"), client.name],
          [t("purchaseTerm"), t("termDays", { count: client.term })],
          [t("dueDate"), dateText(addDays(props.data.today, client.term), i18n.language)],
          [t("currentBalance"), money(account?.balance ?? 0)],
          [t("balanceAfterCharge"), money((account?.balance ?? 0) + total)],
        ]
      : [
          [t("client"), client?.name ?? t("counter")],
          [t("confirmationSaleTotal"), money(total)],
          [t("confirmationMethod"), t(payment.method)],
          ...(payment.method === "cash"
            ? ([
                [t("confirmationReceived"), money(payment.received)],
                [t("change"), money(Math.max(0, payment.received - payment.amount))],
              ] as [string, string][])
            : ([
                [
                  t("bank"),
                  props.data.settings.banks.find((b) => b.id === payment.bankId)?.bank ??
                    t("selectBank"),
                ],
              ] as [string, string][])),
          [t("pendingThisSale"), money(total - payment.amount)],
        ];
  return (
    <section className="ventas-sale-confirmation">
      <span className="ventas-confirm-label">
        {t(credit ? "amountToCharge" : "amountToCollect")}
      </span>
      <strong className="ventas-confirm-amount">{money(credit ? total : payment.amount)}</strong>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
