import { Button } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { accountStatus } from "./account-status.ts";
import { moneyText } from "./format.ts";
import type { ScreenProps } from "./types.ts";
export function SummaryAccounts({
  data,
  onAccount,
}: Pick<ScreenProps, "data"> & { onAccount: (id: string) => void }) {
  const { t, i18n } = useTranslation(),
    byId = new Map(data.accounts.map((a) => [a.clientId, a]));
  const clients = data.clients
    .filter((c) => (byId.get(c.id)?.balance ?? 0) > 0)
    .sort((a, b) => (byId.get(b.id)?.overdue ?? 0) - (byId.get(a.id)?.overdue ?? 0))
    .slice(0, 6);
  return (
    <section className="ventas-summary-panel">
      <h2>{t("accountsToAttend")}</h2>
      {clients.map((c) => {
        const a = byId.get(c.id);
        return a ? (
          <div className="ventas-summary-event" key={c.id}>
            <div>
              <Button variant="ghost" onClick={() => onAccount(c.id)}>
                {c.name}
              </Button>
              <small>{t(`accountStatus.${accountStatus(a, data.today)}`)}</small>
            </div>
            <b>{moneyText(a.balance, i18n.language)}</b>
          </div>
        ) : null;
      })}
      {!clients.length ? <p>{t("allAccountsClear")}</p> : null}
    </section>
  );
}
