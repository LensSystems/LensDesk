import { useTranslation } from "react-i18next";
import { BackupPanel } from "./BackupPanel.tsx";
import { BusinessSettingsForm } from "./BusinessSettingsForm.tsx";
import type { Client, RunRestore, ScreenProps } from "./types.ts";
export function SettingsPage({
  client,
  restore,
  restoredId,
  ...props
}: ScreenProps & { client: Client; restore: RunRestore; restoredId?: string | null }) {
  const { t } = useTranslation();
  return (
    <section className="ventas-settings">
      <h1 className="ventas-page-title">{t("nav.settings")}</h1>
      <p className="text-muted">{t("settingsIntro")}</p>
      <BusinessSettingsForm {...props} key={restoredId ?? "initial"} />
      <BackupPanel {...props} client={client} restore={restore} />
    </section>
  );
}
