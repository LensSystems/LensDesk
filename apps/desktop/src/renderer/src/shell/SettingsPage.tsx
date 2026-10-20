import {
  Button,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@lensdesk/ui";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostSettingKey } from "../../../shared/host-channels.ts";
import { useShellStore } from "../state/store.ts";

import { PageFrame } from "./PageFrame.tsx";
import { SettingsRow } from "./SettingsRow.tsx";
import { SettingsSection } from "./SettingsSection.tsx";

type SettingsPageProps = { bridge: Window["lensdeskHost"] };

export function SettingsPage({ bridge }: SettingsPageProps) {
  const { t, i18n } = useTranslation();
  const updatesDescriptionId = useId();
  const developerDescriptionId = useId();
  const settings = useShellStore((state) => state.settings);
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    void bridge.invoke("app.getInfo", {}).then((result) => {
      if (result.ok) setVersion(result.data.version);
    });
  }, [bridge]);
  const pushToast = useShellStore((state) => state.pushToast);
  const exportLogs = async () => {
    const result = await bridge.invoke("logs.export", {});
    if (!result.ok) {
      const key = `errors.${result.error.code}`;
      pushToast("error", i18n.exists(key) ? t(key) : t("settingsPage.exportLogsError"));
    } else if (result.data.saved) pushToast("success", t("settingsPage.exportLogsSaved"));
  };
  const update = (key: HostSettingKey, value: unknown) =>
    void bridge.invoke("settings.set", { key, value });
  return (
    <PageFrame>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">
          {t("settingsPage.title")}
        </h1>
        <SettingsSection title={t("settingsPage.appearance")}>
          <SettingsRow label={t("settingsPage.language")}>
            <Select value={settings.locale} onValueChange={(value) => update("locale", value)}>
              <SelectTrigger className="w-44" aria-label={t("settingsPage.language")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">{t("settingsPage.spanish")}</SelectItem>
                <SelectItem value="en">{t("settingsPage.english")}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow label={t("settingsPage.theme")}>
            <SegmentedControl
              aria-label={t("settingsPage.theme")}
              value={settings.theme}
              onValueChange={(value) => update("theme", value)}
              options={[
                { value: "system", label: t("settingsPage.system") },
                { value: "light", label: t("settingsPage.light") },
                { value: "dark", label: t("settingsPage.dark") },
              ]}
            />
          </SettingsRow>
        </SettingsSection>
        <SettingsSection title={t("settingsPage.general")}>
          <SettingsRow
            label={t("settingsPage.checkUpdates")}
            description={t("settingsPage.checkUpdatesDescription")}
            descriptionId={updatesDescriptionId}
          >
            <Switch
              aria-label={t("settingsPage.checkUpdates")}
              aria-describedby={updatesDescriptionId}
              checked={settings.updatesCheck}
              onCheckedChange={(value) => update("updates.check", value)}
            />
          </SettingsRow>
          <SettingsRow
            label={t("settingsPage.developerMode")}
            description={t("settingsPage.developerModeDescription")}
            descriptionId={developerDescriptionId}
          >
            <Switch
              aria-label={t("settingsPage.developerMode")}
              aria-describedby={developerDescriptionId}
              checked={settings.developerMode}
              onCheckedChange={(value) => update("developerMode", value)}
            />
          </SettingsRow>
        </SettingsSection>
        <SettingsSection title={t("settingsPage.dataAndLogs")}>
          <SettingsRow description={t("settingsPage.localDataDescription")}>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button onClick={() => void exportLogs()}>{t("settingsPage.exportLogs")}</Button>
              <Button onClick={() => void bridge.invoke("app.openDataFolder", {})}>
                {t("settingsPage.openDataFolder")}
              </Button>
            </div>
          </SettingsRow>
        </SettingsSection>
        <p className="text-[13px] text-muted">
          {t("settingsPage.about", { version: version ?? t("ui.loading") })}
        </p>
      </div>
    </PageFrame>
  );
}
