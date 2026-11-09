import { Button } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { Product } from "../shared/contracts.ts";
import { moneyText, numberText } from "./format.ts";
import { inventoryStatus } from "./inventory-view.ts";
import { ProductIcon } from "./ProductIcon.tsx";
export type InventoryEdit =
  | { type: "product"; product?: Product }
  | { type: "recipe" | "receive" | "adjust" | "prepare" | "active"; product: Product };
export function InventoryTable({
  products,
  edit,
  busy,
}: {
  products: Product[];
  edit: (value: InventoryEdit) => void;
  busy: boolean;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="ventas-table-wrap ventas-inventory-table">
      <table>
        <thead>
          <tr>
            {["product", "kind", "averageCost", "price", "stock", "status", "actions"].map(
              (key) => (
                <th key={key} scope="col">
                  {t(key)}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <th scope="row">
                <div className="ventas-inventory-product">
                  <ProductIcon icon={p.icon} kind={p.kind} size={16} />
                  <span>
                    {p.name}
                    <small className="block text-muted">{p.category}</small>
                  </span>
                </div>
              </th>
              <td>{t(`inventoryKinds.${p.kind}`)}</td>
              <td>
                {moneyText(
                  p.stock ? Math.round(p.value / p.stock) : Math.round(p.lastValue / p.lastQty),
                  i18n.language,
                )}{" "}
                / {t(`units.${p.unit}`)}
              </td>
              <td>{p.kind === "material" ? "—" : moneyText(p.price, i18n.language)}</td>
              <td>
                <strong>
                  {numberText(p.stock, i18n.language)} {t(`units.${p.unit}`)}
                </strong>
                <small className="block text-muted">
                  {t("minimum", { value: numberText(p.minStock, i18n.language) })}
                </small>
              </td>
              <td>
                <span
                  className={`ventas-stock-status${p.active && p.stock <= p.minStock ? " ventas-stock-warning" : ""}`}
                >
                  {t(inventoryStatus(p))}
                </span>
              </td>
              <td>
                <div className="ventas-inventory-actions">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => edit({ type: "product", product: p })}
                  >
                    {t("edit")}
                  </Button>
                  {p.active ? (
                    <>
                      {p.kind !== "prepared" ? (
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => edit({ type: "receive", product: p })}
                        >
                          {t("receive")}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => edit({ type: "adjust", product: p })}
                      >
                        {t("adjustShort")}
                      </Button>
                      {p.kind === "prepared" ? (
                        <>
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => edit({ type: "recipe", product: p })}
                          >
                            {t("recipe")}
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => edit({ type: "prepare", product: p })}
                          >
                            {t("prepare")}
                          </Button>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => edit({ type: "active", product: p })}
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
  );
}
