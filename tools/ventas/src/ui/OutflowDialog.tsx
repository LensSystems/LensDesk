import { type DialogContentProps, Input } from "@lensdesk/ui";
import { Banknote } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { defaultBank } from "../shared/values.ts";
import { OperationModal } from "./OperationModal.tsx";
import { newPayment, PaymentFields, paymentValue } from "./PaymentFields.tsx";
import type { ScreenProps } from "./types.ts";
export function OutflowDialog({
  kind,
  close,
  onCloseAutoFocus,
  ...props
}: ScreenProps & {
  kind: "expense" | "withdrawal";
  close: () => void;
  onCloseAutoFocus?: DialogContentProps["onCloseAutoFocus"];
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(() => newPayment(0, defaultBank(props.data.settings)));
  return (
    <OperationModal
      {...props}
      onCloseAutoFocus={onCloseAutoFocus}
      title={t(kind === "expense" ? "recordExpense" : "recordWithdrawal")}
      description={t(kind === "expense" ? "expenseIntro" : "withdrawalIntro")}
      label={t("recordOutflow")}
      presentationClass="ventas-p3-dialog ventas-operation-dialog"
      icon={<Banknote size={21} aria-hidden="true" />}
      cancelLabel={t("cancel")}
      submitDisabled={value.method === "transfer" && value.bankId === "none"}
      close={close}
      onSubmit={(form) => ({
        type: "outflow",
        kind,
        concept: String(form.get("concept")),
        category: kind === "expense" ? String(form.get("category")) : "",
        payment: paymentValue(value),
      })}
    >
      {(changed) => (
        <>
          <Input label={t("concept")} name="concept" required maxLength={120} />
          {kind === "expense" ? (
            <Input label={t("category")} name="category" maxLength={120} />
          ) : null}
          <PaymentFields
            value={value}
            onChange={setValue}
            banks={props.data.settings.banks}
            changed={changed}
          />
        </>
      )}
    </OperationModal>
  );
}
