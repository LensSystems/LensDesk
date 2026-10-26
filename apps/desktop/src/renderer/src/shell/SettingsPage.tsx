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

import { AppLogo } from "./AppLogo.tsx";
import { PageFrame } from "./PageFrame.tsx";
import { SettingsLoginItem } from "./SettingsLoginItem.tsx";
import { SettingsRow } from "./SettingsRow.tsx";
import { SettingsSection } from "./SettingsSection.tsx";
import { SettingsUpdateCheck } from "./SettingsUpdateCheck.tsx";

type SettingsPageProps = { bridge: Window["lensdeskHost"] };

export function SettingsPage({ bridge }: SettingsPageProps) {
  const { t, i18n } = useTranslation();
  const developerDescriptionId = useId();
  const theme = useShellStore((state) => state.context.theme);
  const settings = useShellStore((state) => state.settings);
  const [releasesRepo, setReleasesRepo] = useState("");
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    void bridge.invoke("app.getInfo", {}).then((result) => {
      if (result.ok) {
        setVersion(result.data.version);
        setReleasesRepo(result.data.releasesRepo ?? "");
      }
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
    <PageFrame settings>
      <div className="mx-auto flex w-full min-[900px]:max-w-2xl flex-col gap-4 min-[900px]:gap-6">
        <h1 className="col-span-full text-2xl leading-8 min-[900px]:text-[28px] min-[900px]:leading-tight font-bold tracking-tight">
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
              indicatorClassName="shadow-none"
              itemClassName="data-[state=checked]:shadow-none"
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
          <SettingsRow label={t("settingsPage.accent")}>
            <SegmentedControl
              indicatorClassName="shadow-none"
              itemClassName="data-[state=checked]:shadow-none"
              aria-label={t("settingsPage.accent")}
              value={settings.accent}
              onValueChange={(value) => update("accent", value)}
              options={(["blue", "green"] as const).map((accent) => ({
                value: accent,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <span data-theme={theme} data-accent={accent} aria-hidden="true">
                      <span className="block size-3 rounded-full bg-accent" />
                    </span>
                    {t(`settingsPage.${accent}`)}
                  </span>
                ),
              }))}
            />
          </SettingsRow>
        </SettingsSection>
        <SettingsSection title={t("settingsPage.general")}>
          <SettingsUpdateCheck
            bridge={bridge}
            version={version ?? ""}
            enabled={releasesRepo !== "" && settings.updatesCheck}
          />
          <SettingsLoginItem bridge={bridge} />
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
            <div className="flex shrink-0 flex-wrap gap-4">
              <Button onClick={() => void exportLogs()}>{t("settingsPage.exportLogs")}</Button>
              <Button onClick={() => void bridge.invoke("app.openDataFolder", {})}>
                {t("settingsPage.openDataFolder")}
              </Button>
            </div>
          </SettingsRow>
        </SettingsSection>
        <SettingsSection title={t("settingsPage.aboutTitle")}>
          <div className="flex items-center gap-4 p-4">
            <AppLogo />
            <div className="leading-tight">
              <p className="text-[22px] font-extrabold tracking-tight">
                <span className="text-text">Lens</span>
                <span className="text-accent">Desk</span>
              </p>
              <p className="text-xs text-muted">{t("settingsPage.byline")}</p>
              <p className="ld-selectable mt-1 font-mono text-xs text-muted">
                {t("settingsPage.appVersion", { version: version ?? t("ui.loading") })}
              </p>
            </div>
          </div>
          <p className="px-4 pb-4 text-[13px] text-muted">{t("settingsPage.aboutDescription")}</p>
        </SettingsSection>
      </div>
    </PageFrame>
  );
}
