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
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useShellStore } from "../state/store.ts";

import { AppLogo } from "./AppLogo.tsx";
import { PageFrame } from "./PageFrame.tsx";
import { SettingsActionStatus } from "./SettingsActionStatus.tsx";
import { SettingsLoginItem } from "./SettingsLoginItem.tsx";
import { SettingsRow } from "./SettingsRow.tsx";
import { SettingsSection } from "./SettingsSection.tsx";
import { SettingsUpdateCheck } from "./SettingsUpdateCheck.tsx";
import { type SettingsAction, useSettingsActions } from "./use-settings-actions.ts";

type SettingsPageProps = { bridge: Window["lensdeskHost"] };

export function SettingsPage({ bridge }: SettingsPageProps) {
  const { t, i18n } = useTranslation();
  const developerDescriptionId = useId();
  const theme = useShellStore((state) => state.context.theme);
  const settings = useShellStore((state) => state.settings);
  const { states, info, update, openFolder } = useSettingsActions(bridge);
  const version = info?.version;
  const availability = (action: SettingsAction) => ({
    "aria-busy": states[action]?.pending ?? false,
    "aria-disabled": states[action]?.pending ?? false,
  });
  const status = (action: SettingsAction, label?: string) => (
    <SettingsActionStatus
      action={action}
      state={states[action]}
      label={label}
      targetId={`${developerDescriptionId}-${action}`}
    />
  );
  const pushToast = useShellStore((state) => state.pushToast);
  const exportLogs = async () => {
    const result = await bridge.invoke("logs.export", {});
    if (!result.ok) {
      const key = `errors.${result.error.code}`;
      pushToast("error", i18n.exists(key) ? t(key) : t("settingsPage.exportLogsError"));
    } else if (result.data.saved) pushToast("success", t("settingsPage.exportLogsSaved"));
  };
  return (
    <PageFrame settings>
      <div className="mx-auto flex w-full min-[900px]:max-w-2xl flex-col gap-4 min-[900px]:gap-6">
        <h1 className="col-span-full text-2xl leading-8 min-[900px]:text-[28px] min-[900px]:leading-tight font-bold tracking-tight">
          {t("settingsPage.title")}
        </h1>
        <SettingsSection title={t("settingsPage.appearance")}>
          <SettingsRow
            id={`${developerDescriptionId}-locale`}
            label={t("settingsPage.language")}
            status={status("locale", t("settingsPage.language"))}
          >
            <Select value={settings.locale} onValueChange={(value) => update("locale", value)}>
              <SelectTrigger
                {...availability("locale")}
                id={`${developerDescriptionId}-locale-control`}
                className="w-44"
                aria-label={t("settingsPage.language")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">{t("settingsPage.spanish")}</SelectItem>
                <SelectItem value="en">{t("settingsPage.english")}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow
            id={`${developerDescriptionId}-theme`}
            label={t("settingsPage.theme")}
            controlsState={availability("theme")}
            status={status("theme", t("settingsPage.theme"))}
          >
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
          <SettingsRow
            id={`${developerDescriptionId}-accent`}
            label={t("settingsPage.accent")}
            controlsState={availability("accent")}
            status={status("accent", t("settingsPage.accent"))}
          >
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
            enabled={!!info?.releasesRepo && settings.updatesCheck}
          />
          <SettingsLoginItem bridge={bridge} />
          <SettingsRow
            label={t("settingsPage.developerMode")}
            id={`${developerDescriptionId}-developerMode`}
            description={t("settingsPage.developerModeDescription")}
            descriptionId={developerDescriptionId}
            status={status("developerMode", t("settingsPage.developerMode"))}
          >
            <Switch
              {...availability("developerMode")}
              id={`${developerDescriptionId}-developerMode-control`}
              aria-label={t("settingsPage.developerMode")}
              aria-describedby={developerDescriptionId}
              checked={settings.developerMode}
              onCheckedChange={(value) => update("developerMode", value)}
            />
          </SettingsRow>
        </SettingsSection>
        <SettingsSection title={t("settingsPage.dataAndLogs")}>
          <SettingsRow
            description={t("settingsPage.localDataDescription")}
            id={`${developerDescriptionId}-folder`}
            status={status("folder")}
          >
            <div className="flex shrink-0 flex-wrap gap-4">
              <Button onClick={() => void exportLogs()}>{t("settingsPage.exportLogs")}</Button>
              <Button
                id={`${developerDescriptionId}-folder-control`}
                onClick={openFolder}
                {...availability("folder")}
              >
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
              <p
                id={`${developerDescriptionId}-info`}
                tabIndex={-1}
                className="ld-selectable mt-1 font-mono text-xs text-muted"
              >
                {t("settingsPage.appVersion", {
                  version:
                    version ??
                    t(states.info?.error ? "settingsPage.versionUnavailable" : "ui.loading"),
                })}
              </p>
            </div>
          </div>
          <div className="px-4">{status("info")}</div>
          <p className="px-4 pb-4 text-[13px] text-muted">{t("settingsPage.aboutDescription")}</p>
        </SettingsSection>
      </div>
    </PageFrame>
  );
}
