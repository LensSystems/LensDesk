import { Button, Input } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { type AccountsState, accountStatus, visibleAccounts } from "./account-status.ts";
import { dateText, moneyText } from "./format.ts";
import type { ScreenProps } from "./types.ts";
export function AccountSidebar({
  data,
  state,
  selected,
  onChange,
  onNew,
}: Pick<ScreenProps, "data"> & {
  state: AccountsState;
  selected?: string;
  onChange: (state: AccountsState) => void;
  onNew: () => void;
}) {
  const { t, i18n } = useTranslation(),
    clients = visibleAccounts(data, state, i18n.language);
  return (
    <aside className="ventas-account-sidebar">
      <div className="ventas-account-heading">
        <h2 className="ventas-section-heading">{t("nav.accounts")}</h2>
        <Button onClick={onNew}>{t("accountsNewClient")}</Button>
      </div>
      <Input
        label={t("searchClient")}
        aria-label={t("searchClient")}
        placeholder={t("searchClient")}
        value={state.query}
        onChange={(e) => onChange({ ...state, query: e.target.value })}
      />
      <fieldset className="ventas-account-filters" aria-label={t("accountFilters")}>
        {(["all", "attention", "clear"] as const).map((filter) => (
          <Button
            key={filter}
            aria-pressed={state.filter === filter}
            onClick={() => onChange({ ...state, filter })}
          >
            {t(`accountFiltersLabels.${filter}`)}
          </Button>
        ))}
      </fieldset>
      <div className="ventas-account-scroll">
        {clients.map((c) => {
          const a = data.accounts.find((a) => a.clientId === c.id);
          return (
            <button
              type="button"
              key={c.id}
              className="ventas-client-row"
              aria-current={selected === c.id ? "true" : undefined}
              onClick={() => onChange({ ...state, selected: c.id })}
            >
              <span>
                <b>{c.name}</b>
                <b>{moneyText(a?.balance ?? 0, i18n.language)}</b>
              </span>
              <span>
                <small>
                  {!c.active ? t("inactive") : t(`accountStatus.${accountStatus(a, data.today)}`)}
                </small>
                <small>
                  {a?.nextDue
                    ? t("accountDue", { date: dateText(a.nextDue, i18n.language) })
                    : t("noPendingDebt")}
                </small>
              </span>
            </button>
          );
        })}
        {!clients.length ? (
          <>
            <p className="ventas-account-empty">{t("accountsNoMatches")}</p>
            <Button variant="primary" onClick={onNew}>
              {t("addClient")}
            </Button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
