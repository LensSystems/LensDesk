import type { DialogContentProps } from "@lensdesk/ui";
import { Banknote } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AccountSummary, ClientRecord } from "../shared/trading-contracts.ts";
import { defaultBank } from "../shared/values.ts";
import { moneyText } from "./format.ts";
import { OperationModal } from "./OperationModal.tsx";
import { newPayment, PaymentFields, paymentValue } from "./PaymentFields.tsx";
import type { ScreenProps } from "./types.ts";
export function AccountPaymentDialog({
  client,
  account,
  full = false,
  close,
  onCloseAutoFocus,
  ...props
}: ScreenProps & {
  client: ClientRecord;
  account: AccountSummary;
  full?: boolean;
  close: () => void;
  onCloseAutoFocus?: DialogContentProps["onCloseAutoFocus"];
}) {
  const { t, i18n } = useTranslation();
  const [value, setValue] = useState(() => ({
    ...newPayment(full ? account.balance : 0, defaultBank(props.data.settings)),
    ...(!full ? { amount: "" } : {}),
  }));
  return (
    <OperationModal
      {...props}
      presentationClass="ventas-p3-dialog ventas-p3-fields"
      icon={<Banknote size={21} aria-hidden="true" />}
      cancelLabel={t("cancel")}
      title={t(full ? "settleAccount" : "recordPayment")}
      description={t("paymentIntro", {
        name: client.name,
        balance: moneyText(account.balance, i18n.language),
      })}
      label={t(full ? "settleAccount" : "recordPayment")}
      close={close}
      onCloseAutoFocus={onCloseAutoFocus}
      onSubmit={() => ({ type: "payAccount", clientId: client.id, payment: paymentValue(value) })}
    >
      {(changed) => (
        <PaymentFields
          variant="account"
          value={value}
          onChange={setValue}
          banks={props.data.settings.banks}
          changed={changed}
        />
      )}
    </OperationModal>
  );
}
