import { Tabs, TabsContent, TabsList, TabsTrigger } from "@lensdesk/ui";
import { Archive, Info, Landmark, Receipt, Store } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BackupPanel } from "./BackupPanel.tsx";
import { SettingsBanks } from "./SettingsBanks.tsx";
import { SettingsBusiness } from "./SettingsBusiness.tsx";
import { SettingsPreview } from "./SettingsPreview.tsx";
import { SettingsReceipts } from "./SettingsReceipts.tsx";
import type { Client, RunRestore, ScreenProps } from "./types.ts";

const categories = [
  ["business", Store],
  ["banks", Landmark],
  ["receipts", Receipt],
  ["backups", Archive],
] as const;
export function SettingsPage({
  client,
  restore,
  restoredId,
  ...props
}: ScreenProps & { client: Client; restore: RunRestore; restoredId?: string | null }) {
  const { t } = useTranslation();
  const [section, setSection] = useState("business");
  const saved = !props.busy && !props.operation.issue;
  return (
    <Tabs value={section} onValueChange={setSection} orientation="vertical" asChild>
      <section className="ventas-settings-workspace">
        <header className="ventas-settings-topbar">
          <div>
            <h1 className="ventas-page-title">{t("nav.settings")}</h1>
            <p>{t("settingsIntro")}</p>
          </div>
          <span className="ventas-settings-status" role="status" data-saved={saved}>
            {t(
              saved
                ? "settingsSavedOnDevice"
                : props.operation.issue
                  ? "settingsNeedsReview"
                  : "settingsSaving",
            )}
          </span>
        </header>
        <nav className="ventas-settings-rail-wrap" aria-label={t("settingsCategories")}>
          <TabsList className="ventas-settings-rail" aria-label={t("settingsCategories")}>
            {categories.map(([key, Icon]) => (
              <TabsTrigger
                key={key}
                value={key}
                aria-label={t(`settingsCategory.${key}`)}
                className="ventas-settings-rail-item"
              >
                <Icon size={19} aria-hidden="true" />
                <span>
                  <b>{t(`settingsCategory.${key}`)}</b>
                  <small>{t(`settingsCategoryDescription.${key}`)}</small>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="ventas-settings-rail-help">
            <Info size={14} aria-hidden="true" />
            <p>{t("settingsLocalHint")}</p>
          </div>
        </nav>
        {section !== "backups" ? (
          <TabsContent value={section} className="ventas-settings-pane">
            {section === "business" ? (
              <SettingsBusiness
                key={restoredId ?? "initial"}
                {...props}
                onBanks={() => setSection("banks")}
              />
            ) : section === "banks" ? (
              <SettingsBanks {...props} />
            ) : (
              <SettingsReceipts {...props} />
            )}
          </TabsContent>
        ) : null}
        <TabsContent
          value="backups"
          forceMount
          hidden={section !== "backups"}
          className="ventas-settings-pane"
        >
          <BackupPanel {...props} client={client} restore={restore} />
        </TabsContent>
        <SettingsPreview data={props.data} />
      </section>
    </Tabs>
  );
}
