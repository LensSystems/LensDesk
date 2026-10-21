import { Switch } from "@lensdesk/ui";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShellStore } from "../state/store.ts";
import { SettingsRow } from "./SettingsRow.tsx";

export function SettingsLoginItem({ bridge }: { bridge: Window["lensdeskHost"] }) {
  const { t } = useTranslation();
  const descriptionId = useId();
  const [available, setAvailable] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(true);
  const pushToast = useShellStore((state) => state.pushToast);
  useEffect(() => {
    let active = true;
    void Promise.all([
      bridge.invoke("app.getInfo", {}),
      bridge.invoke("settings.get", { key: "app.openAtLogin" }),
    ]).then(([info, setting]) => {
      if (!active) return;
      setAvailable(info.ok && info.data.isPackaged === true && setting.ok);
      if (setting.ok) setChecked(setting.data.value === true);
      setBusy(false);
    });
    return () => {
      active = false;
    };
  }, [bridge]);
  const update = async (value: boolean) => {
    if (!available || busy) return;
    setBusy(true);
    const result = await bridge.invoke("settings.set", { key: "app.openAtLogin", value });
    if (result.ok) setChecked(result.data.value === true);
    else pushToast("error", t(`errors.${result.error.code}`));
    setBusy(false);
  };
  return (
    <SettingsRow
      label={t("settingsPage.openAtLogin")}
      description={available ? undefined : t("settingsPage.installedAppOnly")}
      descriptionId={descriptionId}
    >
      <Switch
        aria-label={t("settingsPage.openAtLogin")}
        aria-describedby={available ? undefined : descriptionId}
        checked={checked}
        disabled={!available || busy}
        onCheckedChange={(value) => void update(value)}
      />
    </SettingsRow>
  );
}
