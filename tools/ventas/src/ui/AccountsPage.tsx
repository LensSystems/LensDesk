import { Button, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountHistory } from "./AccountHistory.tsx";
import { AccountPaymentDialog } from "./AccountPaymentDialog.tsx";
import { ClientDialog } from "./ClientDialog.tsx";
import { dateText, moneyText } from "./format.ts";
import { OpeningBalanceDialog } from "./OpeningBalanceDialog.tsx";
import type { ScreenProps } from "./types.ts";
export function AccountsPage(props: ScreenProps & { onSale: () => void }) {
  const { data, run, busy } = props,
    { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<string | null>(() => props.data.draft.clientId),
    [query, setQuery] = useState(""),
    [dialog, setDialog] = useState<"new" | "edit" | "pay" | "settle" | "opening" | null>(null);
  const client = data.clients.find((c) => c.id === (selected ?? data.clients[0]?.id)),
    account = data.accounts.find((a) => a.clientId === client?.id);
  return (
    <section className="ventas-accounts">
      <aside className="ventas-account-list">
        <div className="ventas-section-title">
          <h1>{t("nav.accounts")}</h1>
          <Button onClick={() => setDialog("new")}>{t("addClient")}</Button>
        </div>
        <Input label={t("searchClient")} value={query} onChange={(e) => setQuery(e.target.value)} />
        {data.clients
          .filter((c) =>
            c.name
              .toLocaleLowerCase(i18n.language)
              .includes(query.toLocaleLowerCase(i18n.language)),
          )
          .map((c) => {
            const a = data.accounts.find((a) => a.clientId === c.id);
            return (
              <button
                type="button"
                key={c.id}
                className="ventas-account-row"
                aria-current={client?.id === c.id ? "true" : undefined}
                onClick={() => setSelected(c.id)}
              >
                <strong>{c.name}</strong>
                <span>{moneyText(a?.balance ?? 0, i18n.language)}</span>
                <small>
                  {!c.active
                    ? t("inactive")
                    : (a?.overdue ?? 0) > 0
                      ? t("overdue")
                      : t("currentAccount")}
                </small>
              </button>
            );
          })}
        {!data.clients.length ? <p>{t("emptyClients")}</p> : null}
      </aside>
      <div className="ventas-account-detail">
        {client && account ? (
          <>
            <div className="ventas-section-title">
              <div>
                <h1>{client.name}</h1>
                <p>{client.phone}</p>
              </div>
              <Button onClick={() => setDialog("edit")}>{t("editClient")}</Button>
            </div>
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
                <span>{t("nextDue")}</span>
                <strong>
                  {account.nextDue ? dateText(account.nextDue, i18n.language) : t("noPendingDebt")}
                </strong>
              </div>
            </div>
            <p>
              {t("termPerPurchase", { days: client.term })} ·{" "}
              {client.limit === null
                ? t("unlimitedCredit")
                : t("limitValue", { amount: moneyText(client.limit, i18n.language) })}
            </p>
            <div className="ventas-row-actions">
              <Button
                disabled={busy || !client.active}
                onClick={() =>
                  void run({
                    type: "saveDraft",
                    draft: { ...data.draft, clientId: client.id },
                  }).then((ok) => {
                    if (ok) props.onSale();
                  })
                }
              >
                {t("newSale")}
              </Button>
              <Button disabled={busy || !account.balance} onClick={() => setDialog("pay")}>
                {t("recordPayment")}
              </Button>
              <Button disabled={busy || !account.balance} onClick={() => setDialog("settle")}>
                {t("settleAccount")}
              </Button>
              <Button disabled={busy || !client.active} onClick={() => setDialog("opening")}>
                {t("openingBalance")}
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run({ type: "setClientActive", id: client.id, active: !client.active })
                }
              >
                {t(client.active ? "deactivate" : "activate")}
              </Button>
            </div>
            <AccountHistory {...props} clientId={client.id} />
          </>
        ) : (
          <div className="ventas-empty">
            <h1>{t("emptyClients")}</h1>
            <p>{t("startClients")}</p>
          </div>
        )}
      </div>
      {dialog === "new" || dialog === "edit" ? (
        <ClientDialog
          {...props}
          client={dialog === "edit" ? client : undefined}
          close={() => setDialog(null)}
          onSaved={setSelected}
        />
      ) : null}
      {(dialog === "pay" || dialog === "settle") && client && account ? (
        <AccountPaymentDialog
          {...props}
          client={client}
          account={account}
          full={dialog === "settle"}
          close={() => setDialog(null)}
        />
      ) : null}
      {dialog === "opening" && client ? (
        <OpeningBalanceDialog {...props} client={client} close={() => setDialog(null)} />
      ) : null}
    </section>
  );
}
