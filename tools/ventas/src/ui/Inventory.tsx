import { Button, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Product } from "../shared/contracts.ts";
import { moneyText, numberText } from "./format.ts";
import { HistoryPanel } from "./HistoryPanel.tsx";
import { ProductDialog } from "./ProductDialog.tsx";
import { RecipeDialog } from "./RecipeDialog.tsx";
import { StockDialog } from "./StockDialog.tsx";
import type { ScreenProps } from "./types.ts";

type Edit =
  | { type: "product"; product?: Product }
  | { type: "recipe" | "receive" | "adjust" | "prepare"; product: Product };
export function Inventory(props: ScreenProps) {
  const { data, run, busy } = props;
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState(false);
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const list = data.products.filter((p) =>
    `${p.name} ${p.category}`
      .toLocaleLowerCase(i18n.language)
      .includes(query.toLocaleLowerCase(i18n.language)),
  );
  return (
    <section className="ventas-inventory">
      <div className="ventas-section-title">
        <div>
          <h1>{t("nav.inventory")}</h1>
          <p className="text-muted">{t("inventoryIntro")}</p>
        </div>
        <Button variant="primary" onClick={() => setEdit({ type: "product" })}>
          {t("addProduct")}
        </Button>
      </div>
      <Input
        label={t("searchInventory")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!list.length ? (
        <div className="ventas-empty">
          <h2>{t("emptyInventory")}</h2>
          <p>{t("startInventory")}</p>
        </div>
      ) : (
        <div className="ventas-table-wrap">
          <table>
            <thead>
              <tr>
                {["product", "kind", "stock", "averageCost", "price", "actions"].map((k) => (
                  <th key={k} scope="col">
                    {t(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    <span>{p.name}</span>
                    <small className="block text-muted">
                      {p.category}
                      {!p.active ? ` · ${t("inactive")}` : ""}
                    </small>
                  </th>
                  <td>{t(`kinds.${p.kind}`)}</td>
                  <td>
                    <strong
                      className={p.stock <= p.minStock && p.active ? "text-warning-soft-fg" : ""}
                    >
                      {numberText(p.stock, i18n.language)} {t(`units.${p.unit}`)}
                    </strong>
                    <small className="block text-muted">
                      {t("minimum", { value: numberText(p.minStock, i18n.language) })}
                    </small>
                  </td>
                  <td>
                    {moneyText(
                      p.stock ? Math.round(p.value / p.stock) : Math.round(p.lastValue / p.lastQty),
                      i18n.language,
                    )}
                  </td>
                  <td>{moneyText(p.price, i18n.language)}</td>
                  <td>
                    <div className="ventas-row-actions">
                      <Button onClick={() => setEdit({ type: "product", product: p })}>
                        {t("edit")}
                      </Button>
                      {p.active ? (
                        <>
                          {p.kind !== "prepared" ? (
                            <Button onClick={() => setEdit({ type: "receive", product: p })}>
                              {t("receive")}
                            </Button>
                          ) : null}
                          <Button onClick={() => setEdit({ type: "adjust", product: p })}>
                            {t("adjust")}
                          </Button>
                          {p.kind === "prepared" ? (
                            <>
                              <Button onClick={() => setEdit({ type: "recipe", product: p })}>
                                {t("recipe")}
                              </Button>
                              <Button onClick={() => setEdit({ type: "prepare", product: p })}>
                                {t("prepare")}
                              </Button>
                            </>
                          ) : null}
                        </>
                      ) : null}
                      <Button
                        disabled={busy}
                        onClick={() => void run({ type: "setActive", id: p.id, active: !p.active })}
                      >
                        {t(p.active ? "deactivate" : "activate")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2>{t("movements")}</h2>
      {data.movements.length ? (
        <div className="ventas-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("date")}</th>
                <th>{t("product")}</th>
                <th>{t("movement")}</th>
                <th>{t("quantity")}</th>
                <th>{t("cost")}</th>
                <th>{t("reason")}</th>
              </tr>
            </thead>
            <tbody>
              {data.movements.map((m) => (
                <tr key={m.id}>
                  <td>
                    {new Intl.DateTimeFormat(i18n.language, {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "America/Mexico_City",
                    }).format(new Date(m.at))}
                  </td>
                  <td>{data.products.find((p) => p.id === m.productId)?.name}</td>
                  <td>{t(`movementKinds.${m.kind}`)}</td>
                  <td>{numberText(m.qty, i18n.language)}</td>
                  <td>{moneyText(m.value, i18n.language)}</td>
                  <td>{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted">{t("emptyMovements")}</p>
      )}
      <Button onClick={() => setHistory((h) => !h)}>{t("inventoryHistory")}</Button>
      {history ? <HistoryPanel {...props} kind="inventory" /> : null}
      {edit?.type === "product" ? (
        <ProductDialog {...props} product={edit.product} close={() => setEdit(null)} />
      ) : edit?.type === "recipe" ? (
        <RecipeDialog {...props} product={edit.product} close={() => setEdit(null)} />
      ) : edit ? (
        <StockDialog
          {...props}
          mode={edit.type}
          product={edit.product}
          close={() => setEdit(null)}
        />
      ) : null}
    </section>
  );
}
