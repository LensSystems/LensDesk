import { Button, Input } from "@lensdesk/ui";
import { Candy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { moneyText, numberText } from "./format.ts";
import type { ScreenProps } from "./types.ts";
export function SaleCatalog({
  data,
  busy,
  onAdd,
  onInventory,
}: ScreenProps & { onAdd: (id: string) => void; onInventory: () => void }) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState<string | null>(null);
  const catalog = data.products.filter((p) => p.active && p.kind !== "material");
  const categories = [...new Set(catalog.map((p) => p.category))];
  const products = catalog.filter(
    (p) =>
      (!category || p.category === category) &&
      p.name.toLocaleLowerCase(i18n.language).includes(query.toLocaleLowerCase(i18n.language)),
  );
  return (
    <div className="ventas-catalog">
      <Input
        label={t("searchProduct")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        type="search"
      />
      <fieldset className="ventas-category-list" aria-label={t("categories")}>
        <Button aria-pressed={!category} onClick={() => setCategory(null)}>
          {t("allCategories")}
        </Button>
        {categories.map((c) => (
          <Button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c}
          </Button>
        ))}
      </fieldset>
      {products.length ? (
        <div className="ventas-product-grid">
          {products.map((p) => {
            const qty = data.draft.lines.find((l) => l.productId === p.id)?.qty ?? 0;
            return (
              <button
                type="button"
                key={p.id}
                className="ventas-product"
                aria-label={t("addNamedProduct", { name: p.name })}
                aria-pressed={qty > 0}
                disabled={busy || qty >= p.stock}
                onClick={() => onAdd(p.id)}
              >
                <span className="ventas-product-visual">
                  <Candy aria-hidden="true" size={28} />
                  <span>{p.category}</span>
                  {qty ? <strong className="ventas-qty-badge">{qty}</strong> : null}
                </span>
                <strong className="ventas-product-name">{p.name}</strong>
                <span className="ventas-product-bottom">
                  <strong>{moneyText(p.price, i18n.language)}</strong>
                  <small>{t("stockCount", { stock: numberText(p.stock, i18n.language) })}</small>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="ventas-empty">
          <h1>{t(catalog.length ? "noMatchingProducts" : "emptyCatalog")}</h1>
          <p>{t("startInventory")}</p>
          <Button onClick={onInventory}>{t("nav.inventory")}</Button>
        </div>
      )}
      <p className="ventas-catalog-note">{t("cartDoesNotReserve")}</p>
    </div>
  );
}
