import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Product } from "../shared/contracts.ts";
import { bankLabel, defaultBank } from "../shared/values.ts";
import { Choice } from "./Choice.tsx";
import { DialogFeedback } from "./DialogFeedback.tsx";
import { moneyText, parseMoney } from "./format.ts";
import type { ScreenProps } from "./types.ts";
import { useDialogOperation } from "./use-dialog-operation.ts";

export function StockDialog({
  data,
  product,
  mode,
  run,
  busy,
  operation,
  close,
}: ScreenProps & { product: Product; mode: "receive" | "adjust" | "prepare"; close: () => void }) {
  const { t, i18n } = useTranslation();
  const formOperation = useDialogOperation(run, operation, close);
  const [qty, setQty] = useState(mode === "adjust" ? product.stock : 1);
  const [method, setMethod] = useState("cash");
  const [bank, setBank] = useState(defaultBank(data.settings) ?? "none");
  const [waste, setWaste] = useState("adjustment");
  const recipe = data.recipes.find((r) => r.productId === product.id);
  const material = data.products.find((p) => p.id === recipe?.materialId);
  const pack = data.products.find((p) => p.id === recipe?.packagingId);
  const estimate =
    material && recipe && qty > 0
      ? Math.round((material.value * recipe.grams * qty) / (material.stock || 1)) +
        (pack ? Math.round((pack.value * qty) / (pack.stock || 1)) : 0)
      : 0;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !operation.writing) close();
      }}
    >
      <DialogContent>
        <DialogTitle>
          {t(mode)} · {product.name}
        </DialogTitle>
        <DialogDescription>{t(`${mode}Intro`)}</DialogDescription>
        <form
          className="grid gap-4"
          onChange={formOperation.changed}
          onSubmit={(e) => {
            e.preventDefault();
            if (busy || formOperation.savedDraft) return;
            const form = new FormData(e.currentTarget);
            const action =
              mode === "prepare"
                ? { type: "prepare" as const, productId: product.id, qty }
                : mode === "adjust"
                  ? {
                      type: "adjust" as const,
                      productId: product.id,
                      count: qty,
                      reason: String(form.get("reason")),
                      waste: waste === "waste",
                    }
                  : {
                      type: "receive" as const,
                      productId: product.id,
                      qty,
                      cost: parseMoney(String(form.get("cost"))),
                      method: method as "cash" | "transfer",
                      bankId: method === "transfer" && bank !== "none" ? bank : null,
                    };
            formOperation.submit(action);
          }}
        >
          <DialogFeedback operation={operation} savedDraft={formOperation.savedDraft} />
          <Input
            label={t(mode === "adjust" ? "countedStock" : "quantity")}
            type="number"
            min={mode === "adjust" ? 0 : 1}
            max={1_000_000_000}
            step={1}
            required
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
          {mode === "receive" ? (
            <>
              <Input
                label={t("totalCostPesos")}
                name="cost"
                inputMode="decimal"
                pattern="[0-9]+(\.[0-9]{1,2})?"
                required
                defaultValue="0.00"
              />
              <Choice
                label={t("paymentMethod")}
                value={method}
                onChange={(value) => {
                  formOperation.changed();
                  setMethod(value);
                }}
                options={["cash", "transfer"].map((value) => ({ value, label: t(value) }))}
              />
              {method === "transfer" ? (
                <Choice
                  label={t("bank")}
                  value={bank}
                  onChange={(value) => {
                    formOperation.changed();
                    setBank(value);
                  }}
                  options={
                    data.settings.banks.length
                      ? data.settings.banks.map((b) => ({ value: b.id, label: bankLabel(b) }))
                      : [{ value: "none", label: t("noBanks") }]
                  }
                />
              ) : null}
            </>
          ) : mode === "adjust" ? (
            <>
              <Choice
                label={t("movement")}
                value={waste}
                onChange={(value) => {
                  formOperation.changed();
                  setWaste(value);
                }}
                options={["adjustment", "waste"].map((value) => ({
                  value,
                  label: t(`movementKinds.${value}`),
                }))}
              />
              <Input label={t("reason")} name="reason" required maxLength={500} />
            </>
          ) : (
            <div role="status" className="rounded-ld-md bg-surface p-3">
              <p>
                {recipe && material
                  ? t("consumption", {
                      grams: recipe.grams * qty,
                      material: material.name,
                      qty: pack ? qty : 0,
                      packaging: pack?.name ?? t("noPackaging"),
                    })
                  : t("missingRecipe")}
              </p>
              <p>{t("estimatedCost", { cost: moneyText(estimate, i18n.language) })}</p>
            </div>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={
              busy ||
              formOperation.savedDraft ||
              (mode === "prepare" && !recipe) ||
              (mode === "receive" && method === "transfer" && bank === "none")
            }
          >
            {t("confirm")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
