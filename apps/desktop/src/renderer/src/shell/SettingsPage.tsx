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
  const { t } = useTranslation();
  const settings = useShellStore((state) => state.settings);
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
