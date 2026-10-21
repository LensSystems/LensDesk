import { Button } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostBridge, UpdateCheckResult } from "../../../shared/host-channels.ts";

type Props = { bridge: HostBridge; version: string };

export function SettingsUpdateCheck({ bridge, version }: Props) {
  const { t } = useTranslation();
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    if (checking) return;
    setChecking(true);
    setResult(null);
    try {
      const response = await bridge.invoke("updates.checkNow", {});
      setResult(response.ok ? response.data : { kind: "error" });
    } catch {
      setResult({ kind: "error" });
    } finally {
      setChecking(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <div role="status" className="text-xs text-muted">
        {result?.kind === "none" && t("settingsPage.upToDate", { version })}
        {result?.kind === "error" && t("settingsPage.updateError")}
      </div>
      {result?.kind === "available" ? (
        <Button
          className="h-7 px-3 text-xs"
          onClick={() => void bridge.invoke("app.openExternal", { url: result.url })}
        >
          {t("settingsPage.updateAvailable", { version: result.version })}
        </Button>
      ) : (
        <Button className="h-7 px-3 text-xs" disabled={checking} onClick={() => void check()}>
          {t(
            checking
              ? "settingsPage.checking"
              : result?.kind === "error"
                ? "settingsPage.retryUpdate"
                : "settingsPage.checkNow",
          )}
        </Button>
      )}
    </div>
  );
}
