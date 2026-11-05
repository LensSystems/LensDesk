import { Button, Download } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type {
  HostBridge,
  IncompatibleToolUpdate,
  ToolUpdate,
  UpdateSourceStatus,
} from "../../../shared/host-channels.ts";

import { ToolCompatibilityNotice } from "./ToolCompatibilityNotice.tsx";

export function ToolUpdateActions({
  update,
  incompatible,
  status,
  bridge,
  onInstall,
}: {
  update?: ToolUpdate;
  incompatible?: IncompatibleToolUpdate;
  status?: UpdateSourceStatus;
  bridge: HostBridge;
  onInstall?: () => void;
}) {
  const { t } = useTranslation();
  if (!update && !incompatible) return null;
  return (
    <div className="min-w-0 space-y-3 [overflow-wrap:anywhere] rounded-b-[13px] border-t border-border bg-bg px-5 pt-4 pb-5">
      {status && status !== "success" && (
        <p className="text-[13px] text-muted">{t("settingsPage.previousResults")}</p>
      )}
      {update && (
        <>
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
        </>
      )}
      {incompatible && (
        <div className={update ? "border-t border-border pt-3" : undefined}>
          <ToolCompatibilityNotice incompatible={incompatible} bridge={bridge} />
        </div>
      )}
    </div>
  );
}
