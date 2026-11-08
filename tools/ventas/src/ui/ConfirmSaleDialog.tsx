import { Input } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { addDays } from "../shared/calendar.ts";
import type { PaymentInput } from "../shared/trading-contracts.ts";
import { dateText, moneyText } from "./format.ts";
import { OperationModal } from "./OperationModal.tsx";
import type { ScreenProps } from "./types.ts";
export function ConfirmSaleDialog({
  total,
  payment,
  close,
  onSaved,
  ...props
}: ScreenProps & { total: number; payment: PaymentInput; close: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation(),
    client = props.data.clients.find((c) => c.id === props.data.draft.clientId),
    account = props.data.accounts.find((a) => a.clientId === client?.id);
  const debt = total - payment.amount,
    risk = Boolean(
      client &&
        debt > 0 &&
        ((account?.overdue ?? 0) > 0 ||
          (client.limit !== null && (account?.balance ?? 0) + debt > client.limit)),
    );
  return (
    <OperationModal
      {...props}
      title={t(payment.amount ? "confirmSale" : "chargeAccount")}
      description={t(risk ? "creditExceptionIntro" : "confirmSaleIntro")}
      label={t("confirmSale")}
      close={close}
      onSaved={onSaved}
      onSubmit={(form) => ({
        type: "sell",
        expectedTotal: total,
        payment,
        exception: risk ? String(form.get("exception")) : "",
      })}
    >
      <dl className="ventas-confirm-summary">
        <div>
          <dt>{t("client")}</dt>
          <dd>{client?.name ?? t("counter")}</dd>
        </div>
        <div>
          <dt>{t("saleTotal")}</dt>
          <dd>
            <strong>{moneyText(total, i18n.language)}</strong>
          </dd>
        </div>
        <div>
          <dt>{t("appliedPayment")}</dt>
          <dd>
            <strong>{moneyText(payment.amount, i18n.language)}</strong>
          </dd>
        </div>
        <div>
          <dt>{t("pendingThisSale")}</dt>
          <dd>{moneyText(debt, i18n.language)}</dd>
        </div>
        {payment.amount > 0 ? (
          <>
            <div>
              <dt>{t("paymentMethod")}</dt>
              <dd>{t(payment.method)}</dd>
            </div>
            {payment.method === "cash" ? (
              <div>
                <dt>{t("change")}</dt>
                <dd>{moneyText(Math.max(0, payment.received - payment.amount), i18n.language)}</dd>
              </div>
            ) : (
              <div>
                <dt>{t("bank")}</dt>
                <dd>
                  {props.data.settings.banks.find((b) => b.id === payment.bankId)?.bank ??
                    t("selectBank")}
                </dd>
              </div>
            )}
          </>
        ) : null}
        {client ? (
          <>
            <div>
              <dt>{t("dueDate")}</dt>
              <dd>{dateText(addDays(props.data.today, client.term), i18n.language)}</dd>
            </div>
            <div>
              <dt>{t("projectedBalance")}</dt>
              <dd>{moneyText((account?.balance ?? 0) + debt, i18n.language)}</dd>
            </div>
            <div>
              <dt>{t("paymentDays")}</dt>
              <dd>{client.term}</dd>
            </div>
          </>
        ) : null}
      </dl>
      {risk ? (
        <Input label={t("exceptionReason")} name="exception" required maxLength={500} />
      ) : null}
    </OperationModal>
  );
}
