import { Button } from "@lensdesk/ui";
import { Landmark, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizeSettings } from "../shared/values.ts";
import { BusinessSettingsForm } from "./BusinessSettingsForm.tsx";
import type { ScreenProps } from "./types.ts";

export function SettingsBusiness({ onBanks, ...props }: ScreenProps & { onBanks: () => void }) {
  const { t } = useTranslation();
  const settings = normalizeSettings(props.data.settings);
  return (
    <>
      <div className="ventas-settings-heading">
        <h2>{t("yourBusiness")}</h2>
        <p>{t("businessRecognition")}</p>
      </div>
      <div className="ventas-business-profile">
        <span className="ventas-business-mark">
          <Store size={28} aria-hidden="true" />
        </span>
        <div className="ventas-business-identity">
          <h3>{settings.name || t("unconfiguredBusiness")}</h3>
          <p>{settings.ownerName || t("notConfigured")}</p>
        </div>
        <BusinessSettingsForm {...props} />
      </div>
      <dl className="ventas-business-details">
        {(["address", "phone", "ownerName", "rfc"] as const).map((key) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{settings[key] || t("notConfigured")}</dd>
          </div>
        ))}
      </dl>
      <div className="ventas-settings-next">
        <Landmark size={20} aria-hidden="true" />
        <div>
          <b>{t("readyTransfers")}</b>
          <p>{t("availableAccounts", { count: settings.banks.length })}</p>
        </div>
        <Button onClick={onBanks}>{t("viewBanks")}</Button>
      </div>
    </>
  );
}
