import { Button, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountPaymentDialog } from "./AccountPaymentDialog.tsx";
import { ClientDialog } from "./ClientDialog.tsx";
import { dateText, moneyText, saleFolio } from "./format.ts";
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
            <h2>{t("purchasesAndDue")}</h2>
            <div className="ventas-table-wrap">
              <table>
                <thead>
                  <tr>
                    {["purchase", "dueDate", "amount", "paid", "pending"].map((k) => (
                      <th key={k}>{t(k)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {account.purchases
                    .slice()
                    .reverse()
                    .map((p) => {
                      const sale = data.sales.find((s) => s.id === p.saleId);
                      return (
                        <tr key={p.saleId}>
                          <th scope="row">
                            {sale ? saleFolio(sale) : p.saleId}
                            {sale?.opening ? (
                              <small className="block">
                                {t("openingBalance")} · {sale.note}
                              </small>
                            ) : null}
                          </th>
                          <td>{dateText(p.due, i18n.language)}</td>
                          <td>{moneyText(p.total, i18n.language)}</td>
                          <td>{moneyText(p.paid, i18n.language)}</td>
                          <td>{moneyText(p.pending, i18n.language)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <h2>{t("payments")}</h2>
            {data.payments
              .filter((p) => p.clientId === client.id)
              .slice()
              .reverse()
              .map((p) => (
                <div className="ventas-event" key={p.id}>
                  <span>
                    {t("paymentFolio", { folio: p.folio })} · {dateText(p.date, i18n.language)} ·{" "}
                    {t(p.method)}
                  </span>
                  <strong>{moneyText(p.amount, i18n.language)}</strong>
                </div>
              ))}
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
