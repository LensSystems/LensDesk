import { Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizeSettings } from "../shared/values.ts";
import type { ScreenProps } from "./types.ts";

export function SettingsPreview({ data }: Pick<ScreenProps, "data">) {
  const { t } = useTranslation();
  const settings = normalizeSettings(data.settings);
  const bank = settings.banks.find((b) => b.id === settings.defaultBankId) ?? null;
  return (
    <aside className="ventas-settings-preview" aria-label={t("settingsPreview")}>
      <div className="ventas-settings-preview-title">
        <Receipt size={16} aria-hidden="true" />
        <h2>{t("settingsPreview")}</h2>
      </div>
      <article
        className="ventas-settings-mini-ticket"
        data-theme="light"
        aria-label={t("settingsPreviewPaper")}
      >
        <strong className="ventas-settings-paper-name">
          {settings.name || t("unconfiguredBusiness")}
        </strong>
        <div className="ventas-settings-paper-center">{settings.address}</div>
        <div className="ventas-settings-paper-center">{settings.phone}</div>
        <div className="ventas-settings-paper-cut" />
        <div className="ventas-settings-paper-row">
          <span>{t("servedBy")}</span>
          <span>{settings.cashier || t("notConfigured")}</span>
        </div>
        <div className="ventas-settings-paper-cut" />
        <section className="ventas-bank-details">
          <h3>{t("transferDetails")}</h3>
          {bank ? (
            <>
              <p>
                {t("bank")}: {bank.bank}
              </p>
              <p>
                {t("bankHolderName")}: {bank.holder}
              </p>
              <p>
                {t("clabeShort")}: {bank.clabe}
              </p>
            </>
          ) : (
            <p>{t("noConfiguredBanks")}</p>
          )}
        </section>
        <div className="ventas-settings-paper-cut" />
        <footer>{settings.thanks || t("notConfigured")}</footer>
      </article>
      <p className="ventas-settings-preview-caption">{t("settingsPreviewCaption")}</p>
    </aside>
  );
}
