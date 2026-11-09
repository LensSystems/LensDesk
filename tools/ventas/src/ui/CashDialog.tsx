import { type DialogContentProps, Input } from "@lensdesk/ui";
import { Banknote } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { moneyText, parseMoney } from "./format.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { OperationModal } from "./OperationModal.tsx";
import type { ScreenProps } from "./types.ts";
export function CashDialog({
  close,
  managedDialog = false,
  onCloseAutoFocus,
  ...props
}: ScreenProps & {
  close: () => void;
  managedDialog?: boolean;
  onCloseAutoFocus?: DialogContentProps["onCloseAutoFocus"];
}) {
  const { t, i18n } = useTranslation(),
    current = props.data.cash;
  const [amount, setAmount] = useState(
    ((current ? Math.max(0, current.expected) : 0) / 100).toFixed(2),
  );
  return (
    <OperationModal
      {...props}
      managedDialog={managedDialog}
      onCloseAutoFocus={onCloseAutoFocus}
      presentationClass="ventas-p3-dialog ventas-operation-dialog"
      icon={<Banknote size={21} aria-hidden="true" />}
      cancelLabel={t("cancel")}
      title={t(current ? "closeCash" : "openCash")}
      description={
        current
          ? t("closeCashIntro", { amount: moneyText(current.expected, i18n.language) })
          : t("openCashIntro")
      }
      label={t(current ? "confirmClosing" : "openCash")}
      close={close}
      onSubmit={(form) =>
        current
          ? { type: "closeCash", counted: parseMoney(amount), reason: String(form.get("reason")) }
          : { type: "openCash", initial: parseMoney(amount) }
      }
    >
      <MoneyInput
        label={t(current ? "countedCash" : "openingFloat")}
        value={amount}
        onChange={setAmount}
      />
      {current ? (
        <Input
          label={t("differenceReason")}
          name="reason"
          maxLength={500}
          required={parseMoney(amount) !== current.expected}
        />
      ) : null}
    </OperationModal>
  );
}
