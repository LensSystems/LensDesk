import { Trans, useTranslation } from "react-i18next";
import type { Product, Recipe } from "../shared/contracts.ts";
import { moneyText, numberText } from "./format.ts";
import { preparationPreview } from "./preparation-preview.ts";
export function PreparationPreview({
  product,
  recipe,
  products,
  qty,
}: {
  product?: Product;
  recipe?: Recipe;
  products: Product[];
  qty: number;
}) {
  const { t, i18n } = useTranslation();
  const preview = preparationPreview(product, recipe, products, qty);
  return (
    <section className="ventas-preparation-preview" aria-live="polite">
      {preview.material ? (
        <>
          <strong>
            {t("recipeGrams", { grams: numberText(recipe?.grams ?? 0, i18n.language) })}
          </strong>
          <p className="text-muted">
            {t("materialConsumption", {
              name: preview.material.name,
              qty: numberText(preview.grams, i18n.language),
              stock: numberText(preview.material.stock, i18n.language),
              unit: t("units.g"),
            })}
          </p>
          {preview.pack ? (
            <p className="text-muted">
              {t("materialConsumption", {
                name: preview.pack.name,
                qty: numberText(qty, i18n.language),
                stock: numberText(preview.pack.stock, i18n.language),
                unit: t("units.piece"),
              })}
            </p>
          ) : (
            <p className="text-muted">{t("noPackaging")}</p>
          )}
          <p>
            <Trans
              i18nKey="preparationResult"
              values={{
                qty: numberText(qty, i18n.language),
                stock: numberText(preview.result, i18n.language),
              }}
              components={{ quantity: <strong /> }}
            />
          </p>
          <p>
            <Trans
              i18nKey="estimatedCost"
              values={{ cost: moneyText(preview.cost, i18n.language) }}
              components={{ cost: <strong /> }}
            />
          </p>
        </>
      ) : null}
      {preview.issue ? (
        <p role="alert">
          {t(preview.issue === "E_RECIPE" ? "missingRecipe" : `errors.${preview.issue}`)}
        </p>
      ) : null}
    </section>
  );
}
