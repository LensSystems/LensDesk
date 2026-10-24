import { Button, Download } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { HostBridge, ToolUpdate } from "../../../shared/host-channels.ts";

export function ToolUpdateActions({
  update,
  bridge,
  onInstall,
}: {
  update?: ToolUpdate;
  bridge: HostBridge;
  onInstall?: () => void;
}) {
  const { t } = useTranslation();
  if (!update) return null;
  return (
    <div className="space-y-3 rounded-b-[13px] border-t border-border bg-bg px-5 pt-4 pb-5">
      <p className="flex items-center gap-2 text-[13px] leading-5 font-semibold text-accent">
        <Download aria-hidden size={16} />
        {t("toolsPage.updateAvailable", { version: update.version })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          className="font-semibold"
          variant="primary"
          onClick={() => void bridge.invoke("app.openExternal", { url: update.url })}
        >
          {t("toolsPage.download")}
        </Button>
        <Button onClick={onInstall}>{t("toolsPage.installFile")}</Button>
      </div>
    </div>
  );
}
