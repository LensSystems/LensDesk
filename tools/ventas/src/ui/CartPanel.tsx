import { Button, Trash2 } from "@lensdesk/ui";
import { ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { accountStatus } from "./account-status.ts";
import { CustomerPicker } from "./CustomerPicker.tsx";
import { moneyText } from "./format.ts";
import type { ScreenProps } from "./types.ts";
export function CartPanel({
  total,
  onClient,
  onCreate,
  onQuantity,
  onClear,
  onCredit,
  onCheckout,
  onViewAccount,
  onPayment,
  ...props
}: ScreenProps & {
  total: number | null;
  onClient: (id: string | null) => void;
  onCreate: (query: string) => void;
  onQuantity: (id: string, delta: number) => void;
  onClear: () => void;
  onCredit: () => void;
  onCheckout: () => void;
  onViewAccount: () => void;
  onPayment: () => void;
}) {
  const { data, busy } = props,
    { t, i18n } = useTranslation();
  const client = data.clients.find((c) => c.id === data.draft.clientId),
    account = data.accounts.find((a) => a.clientId === client?.id);
  const valid = Boolean(data.draft.lines.length) && total !== null && !busy;
  return (
    <aside className="ventas-cart">
      <div className="ventas-section-title ventas-sale-heading">
        <h2 className="ventas-section-heading">{t("currentSale")}</h2>
        {client ? (
          <div className="ventas-client-actions">
            <Button variant="ghost" onClick={onViewAccount}>
              {t("viewAccount")}
            </Button>
            <Button variant="ghost" disabled={busy || !account?.balance} onClick={onPayment}>
              {t("recordPayment")}
            </Button>
          </div>
        ) : null}
      </div>
      <CustomerPicker
        today={data.today}
        clients={data.clients}
        accounts={data.accounts}
        value={data.draft.clientId}
        onChange={onClient}
        onCreate={onCreate}
        disabled={busy}
      />
      {client && account ? (
        <div className="ventas-credit-block">
          <div className="ventas-metrics">
            <div>
              <span>{t("accountBalance")}</span>
              <strong>{moneyText(account.balance, i18n.language)}</strong>
            </div>
            <div>
              <span>{t("overdue")}</span>
              <strong>{moneyText(account.overdue, i18n.language)}</strong>
            </div>
            <div>
              <span>{t("creditAvailable")}</span>
              <strong>
                {client.limit === null
                  ? t("unlimitedCredit")
                  : moneyText(Math.max(0, client.limit - account.balance), i18n.language)}
              </strong>
            </div>
          </div>
          <p>
            {t("termPerPurchase", { days: client.term })} ·{" "}
            {t(`accountStatus.${accountStatus(account, data.today)}`)}
            {!client.active ? ` · ${t("inactive")}` : ""}
          </p>
        </div>
      ) : (
        <p>{t("counterCashOnly")}</p>
      )}
      <div className="ventas-cart-lines">
        <div className="ventas-cart-heading">
          <h3 className="ventas-cart-products-title">{t("products")}</h3>
          <span className="ventas-cart-counts">
            {t("cartCounts", {
              pieces: t("pieceCount", {
                count: data.draft.lines.reduce((sum, line) => sum + line.qty, 0),
              }),
              products: t("productCount", { count: data.draft.lines.length }),
            })}
          </span>
          <Button variant="ghost" disabled={!data.draft.lines.length || busy} onClick={onClear}>
            <Trash2 size={16} aria-hidden="true" />
            {t("clearCart")}
          </Button>
        </div>
        <div className="ventas-cart-scroll">
          {data.draft.lines.map((line) => {
            const p = data.products.find((p) => p.id === line.productId);
            const lineTotal = BigInt(p?.price ?? 0) * BigInt(line.qty);
            return (
              <div className="ventas-cart-item" key={line.productId}>
                <div>
                  <strong>{p?.name}</strong>
                  <small>
                    {moneyText(p?.price ?? 0, i18n.language)} {t("each")}
                  </small>
                </div>
                <div className="ventas-stepper">
                  <Button
                    aria-label={t("removeNamedPiece", { name: p?.name })}
                    disabled={busy}
                    onClick={() => onQuantity(line.productId, -1)}
                  >
                    −
                  </Button>
                  <span>{line.qty}</span>
                  <Button
                    aria-label={t("addNamedPiece", { name: p?.name })}
                    disabled={busy || !p?.active || line.qty >= (p?.stock ?? 0)}
                    onClick={() => onQuantity(line.productId, 1)}
                  >
                    +
                  </Button>
                </div>
                <strong>
                  {lineTotal <= 9_000_000_000_000n
                    ? moneyText(Number(lineTotal), i18n.language)
                    : t("amountLimit")}
                </strong>
              </div>
            );
          })}
          {!data.draft.lines.length ? (
            <div className="ventas-empty-cart">
              <ShoppingCart size={30} aria-hidden="true" />
              <strong>{t("saleBeginsHere")}</strong>
              <p>{t("addCatalogProducts")}</p>
            </div>
          ) : null}
        </div>
      </div>
      <footer className="ventas-cart-footer">
        <div className="ventas-total-row">
          <div>
            <span>{t("saleTotal")}</span>
            <strong className="ventas-sale-total">
              {total === null ? t("amountLimit") : moneyText(total, i18n.language)}
            </strong>
          </div>
          {client && account && total !== null ? (
            <div className="ventas-total-projection">
              <span>{t("projectedFullBalance")}</span>
              <strong>{moneyText(account.balance + total, i18n.language)}</strong>
            </div>
          ) : (
            <span className="ventas-sale-mode">{t("counterMode")}</span>
          )}
        </div>
        <div className="ventas-parallel-actions">
          {client ? (
            <Button
              size="lg"
              variant="primary"
              disabled={!valid || !client.active}
              onClick={onCredit}
            >
              {t("chargeAccount")}
            </Button>
          ) : null}
          <Button
            size="lg"
            variant={client ? "default" : "primary"}
            disabled={!valid || Boolean(client && !client.active)}
            onClick={onCheckout}
          >
            {t("checkout")}
          </Button>
        </div>
      </footer>
    </aside>
  );
}
