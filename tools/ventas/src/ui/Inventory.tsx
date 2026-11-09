import { Button, Input, SegmentedControl } from "@lensdesk/ui";
import { Package } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HistoryPanel } from "./HistoryPanel.tsx";
import { type InventoryEdit, InventoryTable } from "./InventoryTable.tsx";
import { type InventoryFilter, inventoryProducts } from "./inventory-view.ts";
import { OperationModal } from "./OperationModal.tsx";
import { ProductDialog } from "./ProductDialog.tsx";
import { RecipeDialog } from "./RecipeDialog.tsx";
import { StockDialog } from "./StockDialog.tsx";
import type { ScreenProps } from "./types.ts";
import { useDialogReturnFocus } from "./use-dialog-return-focus.ts";
export function Inventory(props: ScreenProps) {
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [edit, setEdit] = useState<InventoryEdit | { type: "receive" | "prepare" } | null>(null);
  const root = useRef<HTMLElement>(null);
  const returnFocus = useDialogReturnFocus(root, props.busy, props.operation);
  const restoreFocus = (event: Event) =>
    returnFocus(
      event,
      root.current?.querySelector("[data-inventory-return]")
        ? "[data-inventory-return]"
        : ".ventas-page-title",
    );
  const openEdit: typeof setEdit = (value) => {
    root.current
      ?.querySelector("[data-inventory-return]")
      ?.removeAttribute("data-inventory-return");
    if (document.activeElement instanceof HTMLButtonElement)
      document.activeElement.setAttribute("data-inventory-return", "true");
    setEdit(value);
  };
  const list = inventoryProducts(props.data.products, query, filter, i18n.language);
  return (
    <section ref={root} className="ventas-inventory ventas-inventory-page">
      <div className="ventas-section-title">
        <div>
          <h1 className="ventas-page-title" tabIndex={-1}>
            {t("nav.inventory")}
          </h1>
          <p className="text-muted">{t("inventoryIntro")}</p>
        </div>
        <div className="ventas-inventory-global">
          <Button
            variant="primary"
            disabled={props.busy}
            onClick={() => openEdit({ type: "prepare" })}
          >
            {t("prepareBags")}
          </Button>
          <Button disabled={props.busy} onClick={() => openEdit({ type: "receive" })}>
            {t("receiveGoods")}
          </Button>
          <Button onClick={() => openEdit({ type: "product" })}>{t("addProduct")}</Button>
        </div>
      </div>
      <div className="ventas-inventory-toolbar">
        <div className="ventas-inventory-search">
          <Input
            label={<span className="sr-only">{t("searchInventory")}</span>}
            placeholder={t("searchInventory")}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <SegmentedControl
          aria-label={t("inventoryFilter")}
          className="ventas-inventory-filter"
          itemClassName="ventas-inventory-option"
          indicatorClassName="ventas-inventory-indicator"
          value={filter}
          onValueChange={(v) => setFilter(v as InventoryFilter)}
          options={(["all", "low", "prepared", "material"] as const).map((key) => ({
            value: key,
            label: t(`inventoryFilters.${key}`),
          }))}
        />
        <Button variant="ghost" onClick={() => setHistory((v) => !v)}>
          {t("movements")}
        </Button>
      </div>
      {list.length ? (
        <InventoryTable products={list} edit={openEdit} busy={props.busy} />
      ) : (
        <div className="ventas-empty">
          <h2>{t("emptyInventory")}</h2>
          <p>{t("startInventory")}</p>
        </div>
      )}
      <p className="ventas-inventory-count text-muted">
        {t("inventoryCount", { count: props.data.products.length })}
      </p>
      {history ? <HistoryPanel {...props} kind="inventory" /> : null}
      {edit?.type === "product" ? (
        <ProductDialog
          {...props}
          onCloseAutoFocus={restoreFocus}
          product={edit.product}
          close={() => setEdit(null)}
        />
      ) : edit?.type === "recipe" ? (
        <RecipeDialog
          {...props}
          onCloseAutoFocus={restoreFocus}
          product={edit.product}
          close={() => setEdit(null)}
        />
      ) : edit?.type === "active" ? (
        <OperationModal
          {...props}
          onCloseAutoFocus={restoreFocus}
          title={t(edit.product.active ? "deactivateProduct" : "activateProduct", {
            name: edit.product.name,
          })}
          description={t(edit.product.active ? "deactivateProductIntro" : "activateProductIntro")}
          label={t(edit.product.active ? "deactivate" : "activate")}
          cancelLabel={t("cancel")}
          presentationClass="ventas-p3-dialog ventas-operation-dialog"
          icon={<Package size={22} />}
          close={() => setEdit(null)}
          onSubmit={() => ({
            type: "setActive",
            id: edit.product.id,
            active: !edit.product.active,
          })}
        >
          <p>{edit.product.name}</p>
        </OperationModal>
      ) : edit ? (
        <StockDialog
          {...props}
          onCloseAutoFocus={restoreFocus}
          mode={edit.type}
          product={"product" in edit ? edit.product : undefined}
          close={() => setEdit(null)}
        />
      ) : null}
    </section>
  );
}
