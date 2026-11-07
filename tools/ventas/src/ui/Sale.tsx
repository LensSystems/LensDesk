import { Button, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Choice } from "./Choice.tsx";
import { moneyText, numberText } from "./format.ts";
import type { ScreenProps } from "./types.ts";

export function Sale({ data, onInventory }: ScreenProps & { onInventory: () => void }) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const products = data.products.filter(
    (p) =>
      p.active &&
      p.kind !== "material" &&
      p.name.toLocaleLowerCase(i18n.language).includes(query.toLocaleLowerCase(i18n.language)),
  );
  return (
    <section className="ventas-sale">
      <div className="ventas-catalog">
        <Input
          label={t("searchProduct")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {products.length ? (
          <div className="ventas-product-grid">
            {products.map((p) => (
              <article key={p.id} className="ventas-product">
                <span className="text-muted text-xs">{p.category}</span>
                <h2>{p.name}</h2>
                <strong>{moneyText(p.price, i18n.language)}</strong>
                <span className="text-muted text-xs">
                  {t("stockCount", { count: p.stock, stock: numberText(p.stock, i18n.language) })}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="ventas-empty">
            <h1>{t("emptyCatalog")}</h1>
            <p>{t("startInventory")}</p>
            <Button onClick={onInventory}>{t("nav.inventory")}</Button>
          </div>
        )}
      </div>
      <aside className="ventas-cart">
        <h1>{t("currentSale")}</h1>
        <Choice
          label={t("client")}
          value="counter"
          onChange={() => undefined}
          options={[{ value: "counter", label: t("counter") }]}
        />
        <div className="ventas-cart-lines">
          <h2>{t("products")}</h2>
          <p className="text-muted">{t("emptyCart")}</p>
        </div>
        <div>
          <p className="text-muted">{t("saleTotal")}</p>
          <strong className="text-3xl">{moneyText(0, i18n.language)}</strong>
        </div>
      </aside>
    </section>
  );
}
