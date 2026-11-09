import { Button, Input, SegmentedControl } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { moneyText, numberText } from "./format.ts";
import { ProductIcon } from "./ProductIcon.tsx";
import type { ScreenProps } from "./types.ts";
export function SaleCatalog({
  data,
  busy,
  onAdd,
  onInventory,
  state,
  onState,
}: ScreenProps & {
  onAdd: (id: string) => void;
  onInventory: () => void;
  state: { query: string; category: string };
  onState: (state: { query: string; category: string }) => void;
}) {
  const { t, i18n } = useTranslation();
  const { query, category } = state;
  const catalog = data.products.filter((p) => p.active && p.kind !== "material");
  const available = [...new Set(catalog.map((p) => p.category))];
  const ordered = ["Dulces", "Frituras", "Pan", "Semillas", "Bebidas"];
  const categories = [
    ...ordered.filter((c) => available.includes(c)),
    ...available.filter((c) => !ordered.includes(c)),
  ];
  const products = catalog.filter(
    (p) =>
      (!category || p.category === category) &&
      p.name.toLocaleLowerCase(i18n.language).includes(query.toLocaleLowerCase(i18n.language)),
  );
  return (
    <div className="ventas-catalog">
      <div className="ventas-product-search">
        <Input
          label={t("searchProduct")}
          placeholder={t("searchProductShortcut")}
          data-sale-product-search
          value={query}
          onChange={(e) => onState({ ...state, query: e.target.value })}
          type="search"
        />
      </div>
      <SegmentedControl
        aria-label={t("categories")}
        value={category ? `category:${category}` : "all"}
        onValueChange={(value) =>
          onState({ ...state, category: value === "all" ? "" : value.slice(9) })
        }
        options={[
          { value: "all", label: t("allCategories") },
          ...categories.map((c) => ({ value: `category:${c}`, label: c })),
        ]}
        className="ventas-category-selector"
        itemClassName="ventas-category-option"
        indicatorClassName="ventas-category-indicator"
      />
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
                  <ProductIcon icon={p.icon} kind={p.kind} />
                  <span>{p.category}</span>
                </span>
                {qty ? <strong className="ventas-qty-badge">{qty}</strong> : null}
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
        <div className="ventas-empty ventas-catalog-empty">
          <h1>{t(catalog.length ? "noMatchingProducts" : "emptyCatalog")}</h1>
          <p>{t("startInventory")}</p>
          <Button onClick={onInventory}>{t("nav.inventory")}</Button>
        </div>
      )}
      <p className="ventas-catalog-note">{t("cartDoesNotReserve")}</p>
    </div>
  );
}
