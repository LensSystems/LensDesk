import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Product, ProductInput } from "../shared/contracts.ts";
import { Choice } from "./Choice.tsx";
import { DialogFeedback } from "./DialogFeedback.tsx";
import { parseMoney } from "./format.ts";
import type { ScreenProps } from "./types.ts";
import { useDialogOperation } from "./use-dialog-operation.ts";

export function ProductDialog({
  product,
  run,
  busy,
  operation,
  close,
}: ScreenProps & { product?: Product; close: () => void }) {
  const { t } = useTranslation();
  const formOperation = useDialogOperation(run, operation, close);
  const [kind, setKind] = useState<ProductInput["kind"]>(product?.kind ?? "simple");
  const [unit, setUnit] = useState<ProductInput["unit"]>(product?.unit ?? "piece");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !operation.writing) close();
      }}
    >
      <DialogContent>
        <DialogTitle>{t(product ? "editProduct" : "addProduct")}</DialogTitle>
        <DialogDescription>{t("productIntro")}</DialogDescription>
        <form
          className="grid gap-4"
          onChange={formOperation.changed}
          onSubmit={(e) => {
            e.preventDefault();
            if (busy || formOperation.savedDraft) return;
            const form = new FormData(e.currentTarget);
            formOperation.submit({
              type: "saveProduct",
              product: {
                ...(product ? { id: product.id } : {}),
                name: String(form.get("name")),
                category: String(form.get("category")),
                kind,
                unit: kind === "material" ? unit : "piece",
                price: parseMoney(String(form.get("price"))),
                minStock: Number(form.get("minStock")),
              },
            });
          }}
        >
          <DialogFeedback operation={operation} savedDraft={formOperation.savedDraft} />
          <Input
            label={t("name")}
            name="name"
            required
            maxLength={120}
            defaultValue={product?.name ?? ""}
          />
          <Input
            label={t("category")}
            name="category"
            required
            maxLength={120}
            defaultValue={product?.category ?? ""}
          />
          <Choice
            label={t("kind")}
            value={kind}
            disabled={Boolean(product)}
            options={["simple", "material", "prepared"].map((value) => ({
              value,
              label: t(`kinds.${value}`),
            }))}
            onChange={(v) => {
              formOperation.changed();
              setKind(v as ProductInput["kind"]);
            }}
          />
          {kind === "material" ? (
            <Choice
              label={t("unit")}
              value={unit}
              disabled={Boolean(product)}
              options={["piece", "g"].map((value) => ({ value, label: t(`units.${value}`) }))}
              onChange={(v) => {
                formOperation.changed();
                setUnit(v as ProductInput["unit"]);
              }}
            />
          ) : null}
          <Input
            label={t("pricePesos")}
            name="price"
            inputMode="decimal"
            pattern="[0-9]+(\.[0-9]{1,2})?"
            required
            defaultValue={((product?.price ?? 0) / 100).toFixed(2)}
          />
          <Input
            label={t("minStock")}
            name="minStock"
            type="number"
            min={0}
            max={1_000_000_000}
            step={1}
            required
            defaultValue={product?.minStock ?? 0}
          />
          <Button type="submit" variant="primary" disabled={busy || formOperation.savedDraft}>
            {t("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
