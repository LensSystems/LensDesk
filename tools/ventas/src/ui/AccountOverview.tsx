import { Button } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { Snapshot } from "../shared/contracts.ts";
import { accountStatus } from "./account-status.ts";
import { dateText, moneyText } from "./format.ts";
import type { ScreenProps } from "./types.ts";
export function AccountOverview({
  client,
  account,
  onDialog,
  onSale,
  onStatement,
  ...props
}: ScreenProps & {
  client: Snapshot["clients"][number];
  account: Snapshot["accounts"][number];
  onDialog: (value: "edit" | "pay" | "settle" | "opening") => void;
  onSale: () => void;
  onStatement: () => void;
}) {
  const { t, i18n } = useTranslation(),
    money = (n: number) => moneyText(n, i18n.language),
    status = accountStatus(account, props.data.today);
  return (
    <>
      <div className="ventas-account-heading">
        <div>
          <h1 className="ventas-page-title" tabIndex={-1}>
            {client.name}
          </h1>
          <p>
            {client.phone || t("noPhone")} · {t("termPerPurchase", { days: client.term })}
          </p>
        </div>
        <Button variant="ghost" onClick={() => onDialog("edit")}>
          {t("editClient")}
        </Button>
      </div>
      <div className="ventas-account-balance">
        <div>
          <p>{t("pendingBalance")}</p>
          <strong>{money(account.balance)}</strong>
        </div>
        <span
          className="ventas-account-badge"
          data-tone={account.overdue ? "danger" : account.balance ? "warning" : "success"}
        >
          {t(client.active ? `accountStatus.${status}` : "inactive")}
        </span>
      </div>
      <div className="ventas-account-metrics">
        <div>
          <span>{t("overdue")}</span>
          <b>{money(account.overdue)}</b>
        </div>
        <div>
          <span>{t("nextDue")}</span>
          <b>{account.nextDue ? dateText(account.nextDue, i18n.language) : "—"}</b>
        </div>
        <div>
          <span>{t("accountNetPaid")}</span>
          <b>{money(account.totalPaid)}</b>
        </div>
      </div>
      <div className="ventas-account-actions">
        <Button variant="primary" disabled={props.busy || !client.active} onClick={onSale}>
          {t("newSale")}
        </Button>
        <Button disabled={props.busy || !account.balance} onClick={() => onDialog("pay")}>
          {t("recordPayment")}
        </Button>
        <Button disabled={props.busy || !account.balance} onClick={() => onDialog("settle")}>
          {t("accountSettleAction")}
        </Button>
        <Button disabled={props.busy} onClick={onStatement}>
          {t("statement")}
        </Button>
        <Button
          variant="ghost"
          disabled={props.busy}
          onClick={() =>
            void props.run({ type: "setClientActive", id: client.id, active: !client.active })
          }
        >
          {t(client.active ? "deactivate" : "activate")}
        </Button>
        <Button disabled={props.busy || !client.active} onClick={() => onDialog("opening")}>
          {t("openingBalance")}
        </Button>
      </div>
      {client.limit !== null ? (
        <p className="ventas-account-credit-limit">
          {t("limitValue", { amount: money(client.limit) })}
        </p>
      ) : null}
    </>
  );
}
