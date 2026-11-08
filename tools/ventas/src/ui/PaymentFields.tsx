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
}: {
  value: PaymentForm;
  onChange: (value: PaymentForm) => void;
  banks: Settings["banks"];
  received?: boolean;
  disabled?: boolean;
  changed?: () => void;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof PaymentForm>(key: K, next: PaymentForm[K]) => {
    changed();
    onChange({ ...value, [key]: next });
  };
  return (
    <>
      <MoneyInput
        label={t("appliedPayment")}
        value={value.amount}
        onChange={(v) => set("amount", v)}
        disabled={disabled}
      />
      <Choice
        label={t("paymentMethod")}
        value={value.method}
        disabled={disabled}
        onChange={(v) => set("method", v as PaymentForm["method"])}
        options={["cash", "transfer"].map((value) => ({ value, label: t(value) }))}
      />
      {received ? (
        <MoneyInput
          label={t(value.method === "cash" ? "receivedCash" : "receivedTransfer")}
          value={value.received}
          onChange={(v) => set("received", v)}
          disabled={disabled}
        />
      ) : null}
      {value.method === "transfer" ? (
        <Choice
          label={t("bank")}
          value={value.bankId}
          onChange={(v) => set("bankId", v)}
          disabled={disabled}
          options={[
            { value: "none", label: t("selectBank") },
            ...banks.map((b) => ({ value: b.id, label: bankLabel(b) })),
          ]}
        />
      ) : null}
      <Input
        label={t("paymentReference")}
        value={value.reference}
        onChange={(e) => set("reference", e.target.value)}
        maxLength={200}
        disabled={disabled}
      />
    </>
  );
}
