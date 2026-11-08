import { Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OperationModal } from "./OperationModal.tsx";
import { newPayment, PaymentFields, paymentValue } from "./PaymentFields.tsx";
import type { ScreenProps } from "./types.ts";
export function OutflowDialog({
  kind,
  close,
  ...props
}: ScreenProps & { kind: "expense" | "withdrawal"; close: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(() => newPayment());
  return (
    <OperationModal
      {...props}
      title={t(kind === "expense" ? "recordExpense" : "recordWithdrawal")}
      description={t(kind === "expense" ? "expenseIntro" : "withdrawalIntro")}
      label={t("recordOutflow")}
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
