import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountPaymentDialog } from "./AccountPaymentDialog.tsx";
import { CartPanel } from "./CartPanel.tsx";
import { CheckoutPage } from "./CheckoutPage.tsx";
import { ClientDialog } from "./ClientDialog.tsx";
import { ConfirmSaleDialog } from "./ConfirmSaleDialog.tsx";
import { cartTotal } from "./cart.ts";
import { OperationModal } from "./OperationModal.tsx";
import { SaleCatalog } from "./SaleCatalog.tsx";
import type { ScreenProps } from "./types.ts";
export function Sale({
  onInventory,
  onAccounts,
  ...props
}: ScreenProps & { onInventory: () => void; onAccounts: () => void }) {
  const { t } = useTranslation();
  const [checkout, setCheckout] = useState(false),
    [dialog, setDialog] = useState<"client" | "clear" | "credit" | "pay" | null>(null),
    [newClient, setNewClient] = useState<string | null>(null);
  const { data, run, busy } = props,
    total = cartTotal(data);
  useEffect(() => {
    if (newClient && !busy && data.clients.some((c) => c.id === newClient)) {
      setNewClient(null);
      void run({ type: "saveDraft", draft: { ...data.draft, clientId: newClient } });
    }
  }, [newClient, busy, data, run]);
  const quantity = (productId: string, delta: number) => {
    const lines = data.draft.lines.map((l) => ({ ...l })),
      line = lines.find((l) => l.productId === productId);
    if (line) line.qty += delta;
    else if (delta > 0) lines.push({ productId, qty: delta });
    void run({
      type: "saveDraft",
      draft: { ...data.draft, lines: lines.filter((l) => l.qty > 0) },
    });
  };
  if (checkout && data.draft.lines.length && total !== null)
    return <CheckoutPage {...props} total={total} onBack={() => setCheckout(false)} />;
  return (
    <>
      <section className="ventas-sale">
        <SaleCatalog {...props} onAdd={(id) => quantity(id, 1)} onInventory={onInventory} />
        <CartPanel
          {...props}
          total={total}
          onClient={(clientId) =>
            void run({ type: "saveDraft", draft: { ...data.draft, clientId } })
          }
          onCreate={() => setDialog("client")}
          onQuantity={quantity}
          onClear={() => setDialog("clear")}
          onCredit={() => setDialog("credit")}
          onCheckout={() => setCheckout(true)}
          onViewAccount={onAccounts}
          onPayment={() => setDialog("pay")}
        />
      </section>
      {dialog === "pay"
        ? (() => {
            const client = data.clients.find((c) => c.id === data.draft.clientId),
              account = data.accounts.find((a) => a.clientId === client?.id);
            return client && account ? (
              <AccountPaymentDialog
                {...props}
                client={client}
                account={account}
                close={() => setDialog(null)}
              />
            ) : null;
          })()
        : null}
      {dialog === "client" ? (
        <ClientDialog {...props} close={() => setDialog(null)} onSaved={setNewClient} />
      ) : null}
      {dialog === "clear" ? (
        <OperationModal
          {...props}
          title={t("clearCart")}
          description={t("clearCartIntro")}
          label={t("clearCart")}
          close={() => setDialog(null)}
          onSubmit={() => ({ type: "saveDraft", draft: { ...data.draft, lines: [] } })}
        >
          <p>{t("clearCartIntro")}</p>
        </OperationModal>
      ) : null}
      {dialog === "credit" && total !== null ? (
        <ConfirmSaleDialog
          {...props}
          total={total}
          payment={{ amount: 0, received: 0, method: "cash", bankId: null, reference: "" }}
          close={() => setDialog(null)}
          onSaved={() => setCheckout(false)}
        />
      ) : null}
    </>
  );
}
