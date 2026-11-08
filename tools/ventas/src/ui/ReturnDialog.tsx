import { Input, Notice } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SaleDetail } from "../shared/history-contracts.ts";
import { Choice } from "./Choice.tsx";
import { moneyText, saleFolio } from "./format.ts";
import { OperationModal } from "./OperationModal.tsx";
import type { ScreenProps } from "./types.ts";
export function ReturnDialog({
  detail,
  close,
  ...props
}: ScreenProps & { detail: SaleDetail; close: () => void }) {
  const { t, i18n } = useTranslation(),
    original = detail.sale;
  const available = original.lines
    .map((l) => ({
      ...l,
      available: l.qty - (detail.returned.find((r) => r.lineId === l.id)?.qty ?? 0),
    }))
    .filter((l) => l.available > 0);
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
      Object.fromEntries(available.map((l) => [l.id, String(l.available)])),
    ),
    [restock, setRestock] = useState("yes"),
    [method, setMethod] = useState("cash"),
    [bank, setBank] = useState(props.data.settings.banks[0]?.id ?? "none"),
    [reference, setReference] = useState("");
  let amount = 0n;
  for (const l of available) {
    const qty = Number(quantities[l.id]);
    if (Number.isSafeInteger(qty) && qty >= 0 && qty <= l.available)
      amount += BigInt(l.price) * BigInt(qty);
  }
  const refund = Math.max(0, Number(amount) - detail.balance.pending);
  return (
    <OperationModal
      {...props}
      title={t("returnSaleTitle", { folio: saleFolio(original) })}
      description={t("returnIntro")}
      label={t("confirmReturn")}
      close={close}
      onSubmit={(form) => ({
        type: "returnSale",
        saleId: original.id,
        items: available
          .map((l) => ({ lineId: l.id, qty: Number(quantities[l.id]) }))
          .filter((l) => l.qty !== 0),
        restock: restock === "yes",
        reason: String(form.get("reason")),
        refund: {
          method: method as "cash" | "transfer",
          bankId: method === "transfer" && bank !== "none" ? bank : null,
          reference,
        },
      })}
    >
      {(changed) => (
        <>
          {available.map((l) => (
            <Input
              key={l.id}
              label={t("returnLine", { name: l.name, max: l.available })}
              type="number"
              min={0}
              max={l.available}
              step={1}
              required
              value={quantities[l.id] ?? "0"}
              onChange={(e) => setQuantities((q) => ({ ...q, [l.id]: e.target.value }))}
            />
          ))}
          <Choice
            label={t("returnedGoods")}
            value={restock}
            onChange={(v) => {
              changed();
              setRestock(v);
            }}
            options={[
              { value: "yes", label: t("returnedToStock") },
              { value: "no", label: t("returnedAsLoss") },
            ]}
          />
          <dl className="ventas-confirm-summary">
            <div>
              <dt>{t("returnAmount")}</dt>
              <dd>{moneyText(Number(amount), i18n.language)}</dd>
            </div>
            <div>
              <dt>{t("debtReduction")}</dt>
              <dd>{moneyText(Number(amount) - refund, i18n.language)}</dd>
            </div>
            <div>
              <dt>{t("refund")}</dt>
              <dd>
                <strong>{moneyText(refund, i18n.language)}</strong>
              </dd>
            </div>
          </dl>
          {refund > 0 ? (
            <>
              <Choice
                label={t("refundMethod")}
                value={method}
                onChange={(v) => {
                  changed();
                  setMethod(v);
                }}
                options={["cash", "transfer"].map((value) => ({ value, label: t(value) }))}
              />
              {method === "transfer" ? (
                <Choice
                  label={t("bank")}
                  value={bank}
                  onChange={(v) => {
                    changed();
                    setBank(v);
                  }}
                  options={[
                    { value: "none", label: t("selectBank") },
                    ...props.data.settings.banks.map((b) => ({ value: b.id, label: b.bank })),
                  ]}
                />
              ) : !props.data.cash ? (
                <Notice tone="warning" title={t("errors.E_CASH_CLOSED")} />
              ) : null}
              <Input
                label={t("paymentReference")}
                value={reference}
                maxLength={200}
                onChange={(e) => setReference(e.target.value)}
              />
            </>
          ) : null}
          <Input label={t("reason")} name="reason" required maxLength={500} />
        </>
      )}
    </OperationModal>
  );
}
