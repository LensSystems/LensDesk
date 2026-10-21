import { Badge, Button } from "@lensdesk/ui";
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
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="accent">{t("toolsPage.updateTo", { version: update.version })}</Badge>
      <Button onClick={() => void bridge.invoke("app.openExternal", { url: update.url })}>
        {t("toolsPage.download")}
      </Button>
      <Button onClick={onInstall}>{t("toolsPage.installFile")}</Button>
    </div>
  );
}
