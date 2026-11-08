import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Account, ClientRecord } from "../shared/trading-contracts.ts";
import { moneyText } from "./format.ts";
import { OperationModal } from "./OperationModal.tsx";
import { newPayment, PaymentFields, paymentValue } from "./PaymentFields.tsx";
import type { ScreenProps } from "./types.ts";
export function AccountPaymentDialog({
  client,
  account,
  full = false,
  close,
  ...props
}: ScreenProps & { client: ClientRecord; account: Account; full?: boolean; close: () => void }) {
  const { t, i18n } = useTranslation();
  const [value, setValue] = useState(() => newPayment(full ? account.balance : 0));
  return (
    <OperationModal
      {...props}
      title={t(full ? "settleAccount" : "recordPayment")}
      description={t("paymentIntro", {
        name: client.name,
        balance: moneyText(account.balance, i18n.language),
      })}
      label={t(full ? "settleAccount" : "recordPayment")}
      close={close}
      onSubmit={() => ({ type: "payAccount", clientId: client.id, payment: paymentValue(value) })}
    >
      {(changed) => (
        <PaymentFields
          value={value}
          onChange={setValue}
          banks={props.data.settings.banks}
          changed={changed}
        />
      )}
    </OperationModal>
  );
}
