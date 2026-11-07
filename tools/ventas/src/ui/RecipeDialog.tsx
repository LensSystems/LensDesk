import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Product } from "../shared/contracts.ts";
import { Choice } from "./Choice.tsx";
import { DialogFeedback } from "./DialogFeedback.tsx";
import type { ScreenProps } from "./types.ts";
import { useDialogOperation } from "./use-dialog-operation.ts";

export function RecipeDialog({
  data,
  product,
  run,
  busy,
  operation,
  close,
}: ScreenProps & { product: Product; close: () => void }) {
  const { t } = useTranslation();
  const formOperation = useDialogOperation(run, operation, close);
  const current = data.recipes.find((r) => r.productId === product.id);
  const materials = data.products.filter(
    (p) => p.active && p.kind === "material" && p.unit === "g",
  );
  const packaging = data.products.filter(
    (p) => p.active && p.kind === "material" && p.unit === "piece",
  );
  const [material, setMaterial] = useState(current?.materialId ?? materials[0]?.id ?? "none");
  const [pack, setPack] = useState(current?.packagingId ?? "none");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !operation.writing) close();
      }}
    >
      <DialogContent>
        <DialogTitle>{t("recipeFor", { name: product.name })}</DialogTitle>
        <DialogDescription>{t("recipeIntro")}</DialogDescription>
        <form
          className="grid gap-4"
          onChange={formOperation.changed}
          onSubmit={(e) => {
            e.preventDefault();
            if (busy || formOperation.savedDraft) return;
            const f = new FormData(e.currentTarget);
            formOperation.submit({
              type: "saveRecipe",
              recipe: {
                productId: product.id,
                materialId: material,
                grams: Number(f.get("grams")),
                packagingId: pack === "none" ? null : pack,
              },
            });
          }}
        >
          <DialogFeedback operation={operation} savedDraft={formOperation.savedDraft} />
          <Choice
            label={t("material")}
            value={material}
            onChange={(value) => {
              formOperation.changed();
              setMaterial(value);
            }}
            options={
              materials.length
                ? materials.map((p) => ({ value: p.id, label: p.name }))
                : [{ value: "none", label: t("noMaterials") }]
            }
          />
          <Input
            label={t("gramsPerBag")}
            name="grams"
            type="number"
            min={1}
            max={1_000_000_000}
            step={1}
            required
            defaultValue={current?.grams ?? 100}
          />
          <Choice
            label={t("packaging")}
            value={pack}
            onChange={(value) => {
              formOperation.changed();
              setPack(value);
            }}
            options={[
              { value: "none", label: t("noPackaging") },
              ...packaging.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={busy || formOperation.savedDraft || !materials.length}
          >
            {t("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
