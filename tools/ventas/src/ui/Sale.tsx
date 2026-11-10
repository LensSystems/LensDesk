import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountPaymentDialog } from "./AccountPaymentDialog.tsx";
import { CartPanel } from "./CartPanel.tsx";
import { ClientDialog } from "./ClientDialog.tsx";
import { ConfirmSaleDialog } from "./ConfirmSaleDialog.tsx";
import { cartTotal } from "./cart.ts";
import { OperationModal } from "./OperationModal.tsx";
import { SaleCatalog } from "./SaleCatalog.tsx";
import type { ScreenProps } from "./types.ts";
import { useDialogReturnFocus } from "./use-dialog-return-focus.ts";
import { useSaleClientFocus } from "./use-sale-client-focus.ts";
import { useSaleShortcuts } from "./use-sale-shortcuts.ts";
export function Sale({
  onInventory,
  onAccounts,
  onCheckout,
  onSaved,
  focusRequested,
  onFocused,
  ...props
}: ScreenProps & {
  onInventory: () => void;
  onAccounts: () => void;
  onCheckout: () => void;
  onSaved: (id: string) => void;
  focusRequested?: boolean;
  onFocused?: () => void;
}) {
  const { t } = useTranslation();
  const root = useRef<HTMLElement>(null);
  const [catalog, setCatalog] = useState({ query: "", category: "" });
  const [clientQuery, setClientQuery] = useState("");
  const [dialog, setDialog] = useState<"client" | "clear" | "credit" | "pay" | null>(null),
    [newClient, setNewClient] = useState<string | null>(null);
  const { data, run, busy } = props,
    total = cartTotal(data);
  const creditSaved = useRef(false);
  const returnFocus = useDialogReturnFocus(root, busy, props.operation);
  const clientFocus = useSaleClientFocus(
    root,
    busy,
    dialog === "client",
    newClient,
    data.draft.clientId,
    props.operation,
  );
  useEffect(() => {
    if (newClient && !busy && data.clients.some((c) => c.id === newClient)) {
      setNewClient(null);
      void run({ type: "saveDraft", draft: { ...data.draft, clientId: newClient } });
    }
  }, [newClient, busy, data, run]);
  useSaleShortcuts(root, busy || dialog !== null);
  useEffect(() => {
    if (!focusRequested || busy) return;
    root.current?.querySelector<HTMLInputElement>("[data-sale-product-search]")?.focus();
    onFocused?.();
  }, [focusRequested, busy, onFocused]);
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
  return (
    <>
      <section className="ventas-sale" ref={root}>
        <SaleCatalog
          {...props}
          state={catalog}
          onState={setCatalog}
          onAdd={(id) => quantity(id, 1)}
          onInventory={onInventory}
        />
        <CartPanel
          {...props}
          total={total}
          onClient={(clientId) =>
            void run({ type: "saveDraft", draft: { ...data.draft, clientId } })
          }
          onCreate={(query) => {
            clientFocus.begin();
            setClientQuery(query);
            setDialog("client");
          }}
          onQuantity={quantity}
          onClear={() => setDialog("clear")}
          onCredit={() => {
            creditSaved.current = false;
            setDialog("credit");
          }}
          onCheckout={onCheckout}
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
                onCloseAutoFocus={(event) => returnFocus(event, "[data-sale-client-search]")}
              />
            ) : null;
          })()
        : null}
      {dialog === "client" ? (
        <ClientDialog
          {...props}
          close={() => setDialog(null)}
          initialName={clientQuery}
          onSaved={(id) => {
            clientFocus.created(id);
            setNewClient(id);
          }}
          onCloseAutoFocus={clientFocus.request}
        />
      ) : null}
      {dialog === "clear" ? (
        <OperationModal
          {...props}
          presentationClass="ventas-p3-dialog"
          icon={<Info size={21} aria-hidden="true" />}
          cancelLabel={t("cancel")}
          title={t("clearCart")}
          description={t("clearCartIntro")}
          label={t("clearCart")}
          close={() => setDialog(null)}
          onCloseAutoFocus={(event) => returnFocus(event, "[data-sale-product-search]")}
          onSubmit={() => ({ type: "saveDraft", draft: { ...data.draft, lines: [] } })}
        >
          <p>{t("clearCartIntro")}</p>
        </OperationModal>
      ) : null}
      {dialog === "credit" && total !== null ? (
        <ConfirmSaleDialog
          {...props}
          variant="credit"
          total={total}
          payment={{ amount: 0, received: 0, method: "cash", bankId: null, reference: "" }}
          close={() => setDialog(null)}
          onSaved={(id) => {
            creditSaved.current = true;
            onSaved(id);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!creditSaved.current) returnFocus(event, "[data-sale-credit]");
          }}
        />
      ) : null}
    </>
  );
}
