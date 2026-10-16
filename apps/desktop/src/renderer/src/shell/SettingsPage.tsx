import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostSettingKey } from "../../../shared/host-channels.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/Select.tsx";
import { Switch } from "../components/ui/Switch.tsx";
import { useShellStore } from "../state/store.ts";

type SettingsPageProps = { bridge: Window["lensdeskHost"] };

export function SettingsPage({ bridge }: SettingsPageProps) {
  const { t, i18n } = useTranslation();
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
    <main className="grid gap-4 p-4">
      <h1 className="text-[15px] font-medium">{t("settingsPage.title")}</h1>
      <div className="flex items-center justify-between gap-4">
        <span>{t("settingsPage.language")}</span>
        <Select value={settings.locale} onValueChange={(value) => update("locale", value)}>
          <SelectTrigger aria-label={t("settingsPage.language")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="es">{t("settingsPage.spanish")}</SelectItem>
            <SelectItem value="en">{t("settingsPage.english")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>{t("settingsPage.checkUpdates")}</span>
        <Switch
          aria-label={t("settingsPage.checkUpdates")}
          checked={settings.updatesCheck}
          onCheckedChange={(value) => update("updates.check", value)}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <span>{t("settingsPage.theme")}</span>
        <Select value={settings.theme} onValueChange={(value) => update("theme", value)}>
          <SelectTrigger aria-label={t("settingsPage.theme")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">{t("settingsPage.system")}</SelectItem>
            <SelectItem value="dark">{t("settingsPage.dark")}</SelectItem>
            <SelectItem value="light">{t("settingsPage.light")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <section className="grid gap-2 border-t border-border pt-3">
        <button
          className="h-7 justify-self-start rounded border border-border px-3"
          onClick={() => void exportLogs()}
          type="button"
        >
          {t("settingsPage.exportLogs")}
        </button>
        <button
          className="h-7 justify-self-start rounded border border-border px-3"
          onClick={() => void bridge.invoke("app.openDataFolder", {})}
          type="button"
        >
          {t("settingsPage.openDataFolder")}
        </button>
        <p>{t("settingsPage.about", { version: version ?? t("ui.loading") })}</p>
      </section>
      <div className="flex items-center justify-between gap-4">
        <span>{t("settingsPage.developerMode")}</span>
        <Switch
          aria-label={t("settingsPage.developerMode")}
          checked={settings.developerMode}
          onCheckedChange={(value) => update("developerMode", value)}
        />
      </div>
    </main>
  );
}
