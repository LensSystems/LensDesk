import { type DialogContentProps, Input, Notice } from "@lensdesk/ui";
import { ArrowRightLeft, Banknote, Receipt } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PaymentInput } from "../shared/trading-contracts.ts";
import { OperationModal } from "./OperationModal.tsx";
import { SaleConfirmationSummary } from "./SaleConfirmationSummary.tsx";
import { captureSaleReview, saleReviewSignature } from "./sale-review.ts";
import type { ScreenProps } from "./types.ts";

export function ConfirmSaleDialog({
  total,
  payment,
  close,
  onSaved,
  onCloseAutoFocus,
  variant = "checkout",
  ...props
}: ScreenProps & {
  variant?: "checkout" | "credit";
  total: number;
  payment: PaymentInput;
  close: () => void;
  onSaved: (id: string) => void;
  onCloseAutoFocus?: DialogContentProps["onCloseAutoFocus"];
}) {
  const { t } = useTranslation();
  const [review] = useState(() => captureSaleReview(props.data, total, payment));
  const changedDraft = review.signature !== saleReviewSignature(props.data);
  const client = review.data.clients[0];
  const account = review.data.accounts[0];
  const debt = review.total - review.payment.amount;
  const credit = variant === "credit";
  const risk = Boolean(
    client &&
      debt > 0 &&
      ((account?.overdue ?? 0) > 0 ||
        (client.limit !== null && (account?.balance ?? 0) + debt > client.limit)),
  );
  return (
    <OperationModal
      {...props}
      submitDisabled={changedDraft}
      presentationClass="ventas-p3-dialog ventas-p3-confirmation"
      title={t(credit ? "chargeAccount" : "confirmSale")}
      description={t(
        credit
          ? risk
            ? "creditExceptionIntro"
            : "creditConfirmationIntro"
          : review.payment.method === "transfer"
            ? "transferConfirmationIntro"
            : "cashConfirmationIntro",
      )}
      icon={
        credit ? (
          <Receipt size={21} aria-hidden="true" />
        ) : review.payment.method === "transfer" ? (
          <ArrowRightLeft size={21} aria-hidden="true" />
        ) : (
          <Banknote size={21} aria-hidden="true" />
        )
      }
      label={t(credit ? (risk ? "authorizeCharge" : "confirmCreditSale") : "confirmSale")}
      cancelLabel={t("cancel")}
      close={close}
      onSaved={onSaved}
      onCloseAutoFocus={onCloseAutoFocus}
      onSubmit={(form) => ({
        type: "sell",
        expectedTotal: review.total,
        payment: review.payment,
        exception: risk ? String(form.get("exception")) : "",
      })}
    >
      {changedDraft ? <Notice tone="warning" title={t("reviewChangedDraft")} /> : null}
      <SaleConfirmationSummary
        {...props}
        data={review.data}
        credit={credit}
        total={review.total}
        payment={review.payment}
      />
      {risk ? (
        <Input label={t("exceptionReason")} name="exception" required maxLength={500} />
      ) : null}
    </OperationModal>
  );
}
