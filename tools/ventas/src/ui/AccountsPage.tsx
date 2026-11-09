import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountHistory } from "./AccountHistory.tsx";
import { AccountOverview } from "./AccountOverview.tsx";
import { AccountPaymentDialog } from "./AccountPaymentDialog.tsx";
import { AccountSidebar } from "./AccountSidebar.tsx";
import type { AccountsState } from "./account-status.ts";
import { ClientDialog } from "./ClientDialog.tsx";
import { OpeningBalanceDialog } from "./OpeningBalanceDialog.tsx";
import type { ScreenProps } from "./types.ts";
import { useDialogReturnFocus } from "./use-dialog-return-focus.ts";
export function AccountsPage({
  state,
  onState,
  onStatement,
  focusRequested,
  onFocused,
  ...props
}: ScreenProps & {
  focusRequested?: boolean;
  onFocused?: () => void;
  state: AccountsState;
  onState: (state: AccountsState) => void;
  onSale: () => void;
  onStatement: (clientId: string) => void;
}) {
  const { data, run } = props,
    { t } = useTranslation();
  const [dialog, setDialog] = useState<"new" | "edit" | "pay" | "settle" | "opening" | null>(null);
  const root = useRef<HTMLElement>(null);
  const savedClient = useRef(false);
  const returnFocus = useDialogReturnFocus(root, props.busy, props.operation);
  const destination = useRef<HTMLElement>(null);
  const [pendingSale, setPendingSale] = useState<{ id: string; confirmed: boolean } | null>(null);
  useEffect(() => {
    if (
      pendingSale?.confirmed &&
      !props.busy &&
      !props.operation.issue &&
      data.draft.clientId === pendingSale.id
    ) {
      props.onSale();
    }
  }, [pendingSale, props.busy, props.operation.issue, data.draft.clientId, props.onSale]);
  const client =
      data.clients.find((c) => c.id === (state.selected ?? data.clients[0]?.id)) ?? data.clients[0],
    account = data.accounts.find((a) => a.clientId === client?.id);
  useLayoutEffect(() => {
    if (focusRequested && client) {
      destination.current?.querySelector<HTMLElement>("h1")?.focus();
      onFocused?.();
    }
  }, [focusRequested, client, onFocused]);
  return (
    <section className="ventas-accounts-workspace" ref={root}>
      <AccountSidebar
        data={data}
        state={state}
        selected={client?.id}
        onChange={onState}
        onNew={() => {
          savedClient.current = false;
          setDialog("new");
        }}
      />
      <section ref={destination} className="ventas-account-content" aria-label={t("accountDetail")}>
        {client && account ? (
          <>
            <AccountOverview
              {...props}
              busy={props.busy || Boolean(pendingSale)}
              client={client}
              account={account}
              onDialog={setDialog}
              onStatement={() => onStatement(client.id)}
              onSale={() => {
                if (pendingSale) return;
                const id = client.id;
                setPendingSale({ id, confirmed: false });
                void run({ type: "saveDraft", draft: { ...data.draft, clientId: id } }).then(
                  (ok) => {
                    setPendingSale(ok ? { id, confirmed: true } : null);
                  },
                );
              }}
            />
            <AccountHistory {...props} clientId={client.id} />
          </>
        ) : (
          <p className="ventas-account-empty">{t("startClients")}</p>
        )}
      </section>
      {dialog === "new" || dialog === "edit" ? (
        <ClientDialog
          {...props}
          client={dialog === "edit" ? client : undefined}
          close={() => setDialog(null)}
          onSaved={(selected) => {
            savedClient.current = true;
            onState({ ...state, selected });
          }}
          onCloseAutoFocus={(event) =>
            returnFocus(
              event,
              savedClient.current || client ? ".ventas-account-content h1" : "[data-account-new]",
            )
          }
        />
      ) : null}
      {(dialog === "pay" || dialog === "settle") && client && account ? (
        <AccountPaymentDialog
          {...props}
          client={client}
          account={account}
          full={dialog === "settle"}
          onCloseAutoFocus={(event) => returnFocus(event, ".ventas-account-content h1")}
          close={() => setDialog(null)}
        />
      ) : null}
      {dialog === "opening" && client ? (
        <OpeningBalanceDialog {...props} client={client} close={() => setDialog(null)} />
      ) : null}
    </section>
  );
}
