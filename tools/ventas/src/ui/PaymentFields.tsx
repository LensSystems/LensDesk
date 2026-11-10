import { Input } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { Settings } from "../shared/contracts.ts";
import type { PaymentInput } from "../shared/trading-contracts.ts";
import { bankLabel } from "../shared/values.ts";
import { Choice } from "./Choice.tsx";
import { parseMoney } from "./format.ts";
import { MoneyInput } from "./MoneyInput.tsx";

export type PaymentForm = {
  amount: string;
  received: string;
  method: "cash" | "transfer";
  bankId: string;
  reference: string;
};
export const newPayment = (amount = 0, bankId: string | null = null): PaymentForm => ({
  amount: (amount / 100).toFixed(2),
  received: (amount / 100).toFixed(2),
  method: "cash",
  bankId: bankId ?? "none",
  reference: "",
});
export function paymentValue(form: PaymentForm, received = false): PaymentInput {
  const amount = parseMoney(form.amount);
  return {
    amount,
    received: received ? parseMoney(form.received) : amount,
    method: form.method,
    bankId: form.method === "transfer" && form.bankId !== "none" ? form.bankId : null,
    reference: form.reference,
  };
}
export function PaymentFields({
  value,
  onChange,
  banks,
  received = false,
  disabled = false,
  changed = () => {},
  variant = "default",
  amountLabel: customAmountLabel,
  showReference = true,
}: {
  value: PaymentForm;
  onChange: (value: PaymentForm) => void;
  banks: Settings["banks"];
  received?: boolean;
  disabled?: boolean;
  changed?: () => void;
  variant?: "default" | "checkout" | "account";
  amountLabel?: string;
  showReference?: boolean;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof PaymentForm>(key: K, next: PaymentForm[K]) => {
    changed();
    onChange({ ...value, [key]: next });
  };
  const amountLabel =
    customAmountLabel ??
    t(
      variant === "account"
        ? "accountPaymentAmount"
        : variant === "checkout"
          ? "checkoutAppliedPayment"
          : "appliedPayment",
    );
  const methodLabel = t(variant === "account" ? "confirmationMethod" : "paymentMethod");
  return (
    <>
      {variant !== "checkout" ? (
        <>
          <MoneyInput
            label={amountLabel}
            value={value.amount}
            onChange={(v) => set("amount", v)}
            disabled={disabled}
          />
          <Choice
            label={methodLabel}
            value={value.method}
            disabled={disabled}
            onChange={(v) => set("method", v as PaymentForm["method"])}
            options={["cash", "transfer"].map((value) => ({ value, label: t(value) }))}
          />
        </>
      ) : (
        <>
          <Choice
            label={methodLabel}
            value={value.method}
            disabled={disabled}
            onChange={(v) => set("method", v as PaymentForm["method"])}
            options={["cash", "transfer"].map((value) => ({ value, label: t(value) }))}
          />
          <MoneyInput
            label={amountLabel}
            value={value.amount}
            onChange={(v) => set("amount", v)}
            disabled={disabled}
          />
        </>
      )}
      {received ? (
        <MoneyInput
          label={t(
            variant === "checkout"
              ? value.method === "cash"
                ? "checkoutReceivedCash"
                : "checkoutReceivedTransfer"
              : value.method === "cash"
                ? "receivedCash"
                : "receivedTransfer",
          )}
          value={value.received}
          onChange={(v) => set("received", v)}
          disabled={disabled}
        />
      ) : null}
      {value.method === "transfer" ? (
        <Choice
          label={t(
            variant === "checkout"
              ? "checkoutBank"
              : variant === "account"
                ? "accountPaymentBank"
                : "bank",
          )}
          value={value.bankId}
          onChange={(v) => set("bankId", v)}
          disabled={disabled}
          options={[
            { value: "none", label: t("selectBank") },
            ...banks.map((b) => ({ value: b.id, label: bankLabel(b) })),
          ]}
        />
      ) : null}
      {showReference && (variant !== "checkout" || value.method === "transfer") ? (
        <Input
          label={t("paymentReference")}
          value={value.reference}
          onChange={(e) => set("reference", e.target.value)}
          maxLength={200}
          disabled={disabled}
        />
      ) : null}
    </>
  );
}
