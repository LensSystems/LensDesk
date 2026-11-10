import { Button, Input } from "@lensdesk/ui";
import { Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizeSettings } from "../shared/values.ts";
import { Choice } from "./Choice.tsx";
import { SettingsDialog } from "./SettingsDialog.tsx";
import type { ScreenProps } from "./types.ts";

export function SettingsReceipts(props: ScreenProps) {
  const { t } = useTranslation();
  const settings = normalizeSettings(props.data.settings);
  const term = (defaultTerm: number) =>
    void props.run({ type: "saveSettings", settings: { ...settings, defaultTerm } });
  return (
    <>
      <div className="ventas-settings-heading">
        <h2>{t("receiptPreferences")}</h2>
        <p>{t("receiptPreferencesIntro")}</p>
      </div>
      <section className="ventas-receipt-preferences">
        <div className="ventas-preference-heading">
          <Receipt size={18} aria-hidden="true" />
          <h3>{t("ticketClosing")}</h3>
          <SettingsDialog
            {...props}
            title={t("customizeTickets")}
            icon={Receipt}
            trigger={t("customize")}
            description={t("ticketMessageIntro")}
            confirm={t("savePreferences")}
            onSubmit={(form) => ({
              ...props.data.settings,
              cashier: String(form.get("cashier")),
              thanks: String(form.get("thanks")),
            })}
          >
            <Input
              name="cashier"
              pattern={".*\\S.*"}
              required
              label={t("cashier")}
              defaultValue={settings.cashier}
              maxLength={120}
            />
            <Input
              name="thanks"
              pattern={".*\\S.*"}
              required
              label={t("thanks")}
              defaultValue={settings.thanks}
              maxLength={300}
            />
          </SettingsDialog>
        </div>
        <blockquote>{settings.thanks || t("notConfigured")}</blockquote>
        <p>
          {t("servedBy")}: {settings.cashier || t("notConfigured")}
        </p>
      </section>
      <section className="ventas-term-preferences">
        <h3>{t("termTitle")}</h3>
        <p>{t("defaultTermIntro")}</p>
        <fieldset className="ventas-term-shortcuts" aria-label={t("frequentTerms")}>
          {[7, 15, 21, 30].map((days) => (
            <Button
              key={days}
              disabled={props.busy}
              aria-pressed={settings.defaultTerm === days}
              onClick={() => term(days)}
            >
              {t("termDays", { count: days })}
            </Button>
          ))}
        </fieldset>
        <div className="ventas-term-select">
          <Choice
            label={t("defaultTermLabel")}
            visibleLabel={t("chooseTerm")}
            value={String(settings.defaultTerm)}
            disabled={props.busy}
            options={Array.from({ length: 30 }, (_, i) => ({
              value: String(i + 1),
              label: t("termDays", { count: i + 1 }),
            }))}
            onChange={(value) => term(Number(value))}
          />
        </div>
      </section>
    </>
  );
}
