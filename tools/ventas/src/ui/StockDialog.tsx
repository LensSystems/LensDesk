import { type DialogContentProps, Input } from "@lensdesk/ui";
import { Package } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Action, Product } from "../shared/contracts.ts";
import { defaultBank } from "../shared/values.ts";
import { Choice } from "./Choice.tsx";
import { OperationModal } from "./OperationModal.tsx";
import { newPayment, PaymentFields, paymentValue } from "./PaymentFields.tsx";
import { PreparationPreview } from "./PreparationPreview.tsx";
import { preparationPreview } from "./preparation-preview.ts";
import type { ScreenProps } from "./types.ts";
export function StockDialog({
  product: initialProduct,
  mode,
  close,
  onCloseAutoFocus,
  ...props
}: ScreenProps & {
  onCloseAutoFocus?: DialogContentProps["onCloseAutoFocus"];
  product?: Product;
  mode: "receive" | "adjust" | "prepare";
  close: () => void;
}) {
  const { t } = useTranslation();
  const candidates = props.data.products.filter(
    (p) =>
      p.active &&
      (mode === "prepare"
        ? p.kind === "prepared"
        : mode === "receive"
          ? p.kind !== "prepared"
          : p.id === initialProduct?.id),
  );
  const [selected, setSelected] = useState(initialProduct?.id ?? candidates[0]?.id ?? "none");
  const product = candidates.find((p) => p.id === selected);
  const [qty, setQty] = useState(
    mode === "adjust" ? (initialProduct?.stock ?? 0) : mode === "prepare" ? 10 : 1,
  );
  const [payment, setPayment] = useState(() => newPayment(0, defaultBank(props.data.settings)));
  const [waste, setWaste] = useState("adjustment");
  const recipe = props.data.recipes.find((r) => r.productId === product?.id);
  const preview = preparationPreview(product, recipe, props.data.products, qty);
  const invalidQuantity =
    !Number.isSafeInteger(qty) || qty < (mode === "adjust" ? 0 : 1) || qty > 1_000_000_000;
  const invalid =
    !product ||
    invalidQuantity ||
    (mode === "prepare" && !!preview.issue) ||
    (mode === "receive" && payment.method === "transfer" && payment.bankId === "none");
  const submit = (form: FormData): Action => {
    if (!product) throw new Error("Missing product");
    if (mode === "prepare") return { type: "prepare", productId: product.id, qty };
    if (mode === "adjust")
      return {
        type: "adjust",
        productId: product.id,
        count: qty,
        reason: String(form.get("reason")),
        waste: waste === "waste",
      };
    const value = paymentValue(payment);
    return {
      type: "receive",
      productId: product.id,
      qty,
      cost: value.amount,
      method: value.method,
      bankId: value.bankId,
    };
  };
  return (
    <OperationModal
      {...props}
      title={
        initialProduct
          ? `${t(mode)} · ${initialProduct.name}`
          : t(mode === "prepare" ? "prepareBags" : "receiveGoods")
      }
      description={t(`${mode}Intro`)}
      label={t(mode === "prepare" ? "confirmPreparation" : "confirm")}
      close={close}
      onSubmit={submit}
      onCloseAutoFocus={onCloseAutoFocus}
      submitDisabled={invalid}
      cancelLabel={t("cancel")}
      presentationClass="ventas-p3-dialog ventas-operation-dialog ventas-stock-dialog"
      icon={<Package size={22} aria-hidden="true" />}
    >
      {(changed) => (
        <>
          {!initialProduct ? (
            <Choice
              label={t(mode === "prepare" ? "productToPrepare" : "productOrMaterial")}
              value={selected}
              disabled={props.operation.writing}
              onChange={(v) => {
                changed();
                setSelected(v);
              }}
              options={
                candidates.length
                  ? candidates.map((p) => ({
                      value: p.id,
                      label: mode === "prepare" ? p.name : `${p.name} · ${t(`units.${p.unit}`)}`,
                    }))
                  : [
                      {
                        value: "none",
                        label: t(
                          mode === "prepare" ? "noPreparedProducts" : "noReceivableProducts",
                        ),
                      },
                    ]
              }
            />
          ) : null}
          {!product ? (
            <p role="alert">
              {t(mode === "prepare" ? "noPreparedProducts" : "noReceivableProducts")}
            </p>
          ) : null}
          <Input
            label={t(
              mode === "adjust" ? "countedStock" : mode === "prepare" ? "bagQuantity" : "quantity",
            )}
            type="number"
            min={mode === "adjust" ? 0 : 1}
            max={1_000_000_000}
            step={1}
            required
            value={qty}
            disabled={props.operation.writing}
            onChange={(e) => setQty(Number(e.target.value))}
          />
          {mode === "receive" ? (
            <PaymentFields
              amountLabel={t("totalCostPesos")}
              showReference={false}
              value={payment}
              onChange={setPayment}
              banks={props.data.settings.banks}
              changed={changed}
              disabled={props.operation.writing}
            />
          ) : mode === "adjust" ? (
            <>
              <Choice
                label={t("movement")}
                value={waste}
                disabled={props.operation.writing}
                onChange={(v) => {
                  changed();
                  setWaste(v);
                }}
                options={["adjustment", "waste"].map((value) => ({
                  value,
                  label: t(`movementKinds.${value}`),
                }))}
              />
              <Input label={t("reason")} name="reason" required maxLength={500} />
            </>
          ) : (
            <PreparationPreview
              product={product}
              recipe={recipe}
              products={props.data.products}
              qty={qty}
            />
          )}
        </>
      )}
    </OperationModal>
  );
}
