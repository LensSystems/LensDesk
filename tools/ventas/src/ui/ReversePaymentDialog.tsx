import { Input } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { OperationModal } from "./OperationModal.tsx";
import type { ScreenProps } from "./types.ts";
export function ReversePaymentDialog({
  paymentId,
  close,
  ...props
}: ScreenProps & { paymentId: string; close: () => void }) {
  const { t } = useTranslation();
  return (
    <OperationModal
      {...props}
      title={t("reversePayment")}
      description={t("reverseIntro")}
      label={t("confirmReversal")}
      close={close}
      onSubmit={(form) => ({
        type: "reversePayment",
        paymentId,
        reason: String(form.get("reason")),
      })}
    >
      <Input label={t("reason")} name="reason" required maxLength={500} />
    </OperationModal>
  );
}
