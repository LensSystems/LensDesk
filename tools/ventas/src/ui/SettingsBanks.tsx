import { Button } from "@lensdesk/ui";
import { Landmark } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { normalizeSettings } from "../shared/values.ts";
import { BankSettingsDialog } from "./BankSettingsDialog.tsx";
import { SettingsDialog } from "./SettingsDialog.tsx";
import type { ScreenProps } from "./types.ts";

export function SettingsBanks(props: ScreenProps) {
  const { t } = useTranslation();
  const cards = useRef(new Map<string, HTMLElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<{ kind: "default" | "remove"; id: string } | null>(null);
  const createdAtLimit = useRef<string | null>(null);
  useLayoutEffect(() => {
    const request = pendingFocus.current;
    if (!request || props.busy) return;
    const current = normalizeSettings(props.data.settings);
    const completed =
      request.kind === "default"
        ? current.defaultBankId === request.id
        : !current.banks.some((bank) => bank.id === request.id);
    if (!completed) return;
    pendingFocus.current = null;
    const target =
      request.kind === "remove" ? (current.defaultBankId ?? current.banks[0]?.id) : request.id;
    (target ? cards.current.get(target) : addButton.current)?.focus();
  }, [props.busy, props.data.settings]);
  const settings = normalizeSettings(props.data.settings);
  const banks = [...settings.banks].sort(
    (a, b) => Number(b.id === settings.defaultBankId) - Number(a.id === settings.defaultBankId),
  );
  return (
    <>
      <div className="ventas-settings-heading">
        <h2>{t("receiveTransfers")}</h2>
        <p>{t("chooseDefaultBank")}</p>
      </div>
      <div className="ventas-bank-cards">
        {banks.map((bank) => (
          <article
            key={bank.id}
            tabIndex={-1}
            aria-label={
              bank.alias ? `${bank.alias} · ${bank.bank}` : `${bank.bank} · ${bank.holder}`
            }
            ref={(element) => {
              if (element) cards.current.set(bank.id, element);
              else cards.current.delete(bank.id);
            }}
            className={`ventas-bank-card${bank.id === settings.defaultBankId ? " is-default" : ""}`}
          >
            <div className="ventas-bank-heading">
              <span className="ventas-bank-symbol">
                <Landmark size={20} aria-hidden="true" />
              </span>
              <div>
                <h3>{bank.bank}</h3>
                <p>{bank.alias || bank.holder}</p>
              </div>
              {bank.id === settings.defaultBankId ? (
                <span className="ventas-bank-default">{t("defaultAccount")}</span>
              ) : null}
            </div>
            <div className="ventas-bank-card-details">
              <span>{bank.holder}</span>
              <span className="ventas-bank-clabe">{bank.clabe}</span>
            </div>
            <div className="ventas-bank-actions">
              <BankSettingsDialog {...props} bank={bank} />
              {bank.id !== settings.defaultBankId ? (
                <Button
                  disabled={props.busy}
                  onClick={() => {
                    pendingFocus.current = { kind: "default", id: bank.id };
                    void props
                      .run({
                        type: "saveSettings",
                        settings: { ...settings, defaultBankId: bank.id },
                      })
                      .then((ok) => {
                        if (!ok) pendingFocus.current = null;
                      });
                  }}
                >
                  {t("useDefaultBank")}
                </Button>
              ) : null}
              <SettingsDialog
                {...props}
                title={t("removeBank")}
                icon={Landmark}
                description={t("removeBankIntro")}
                trigger={t("removeBank")}
                confirm={t("removeBank")}
                onSubmit={() => {
                  pendingFocus.current = { kind: "remove", id: bank.id };
                  const remaining = settings.banks.filter((b) => b.id !== bank.id);
                  return {
                    ...settings,
                    banks: remaining,
                    defaultBankId:
                      bank.id === settings.defaultBankId
                        ? (remaining[0]?.id ?? null)
                        : settings.defaultBankId,
                  };
                }}
              >
                <p>{bank.alias || bank.bank}</p>
              </SettingsDialog>
            </div>
          </article>
        ))}
      </div>
      {!banks.length ? <p className="text-muted">{t("noConfiguredBanks")}</p> : null}
      <BankSettingsDialog
        {...props}
        disabled={banks.length >= 20}
        triggerRef={addButton}
        onLimitCreated={(id) => {
          createdAtLimit.current = id;
        }}
        onUnavailableTriggerFocus={() => {
          const id = createdAtLimit.current;
          createdAtLimit.current = null;
          const target = id ? cards.current.get(id) : null;
          if (!target?.isConnected || target.closest("[hidden]")) return false;
          target.focus();
          return true;
        }}
      />
    </>
  );
}
