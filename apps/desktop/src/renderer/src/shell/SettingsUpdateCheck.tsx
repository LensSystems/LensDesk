import { IconButton, RefreshCw, Switch } from "@lensdesk/ui";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostBridge, UpdateCheckResult } from "../../../shared/host-channels.ts";
import { useShellStore } from "../state/store.ts";
import { SettingsRow } from "./SettingsRow.tsx";
import { SettingsUpdateStatus } from "./SettingsUpdateStatus.tsx";

type Props = { bridge: HostBridge; version: string; enabled: boolean };

export function SettingsUpdateCheck({ bridge, version, enabled }: Props) {
  const { t } = useTranslation();
  const descriptionId = useId();
  const row = useRef<HTMLDivElement>(null);
  const update = useShellStore((state) => state.update);
  const request = useShellStore((state) => state.updateSettingsRequest);
  const updatesCheck = useShellStore((state) => state.settings.updatesCheck);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [highlighted, setHighlighted] = useState(false);
  useEffect(() => {
    if (!request) return;
    setHighlighted(true);
    row.current?.scrollIntoView?.({ block: "nearest" });
    row.current
      ?.querySelector<HTMLAnchorElement>("[data-update-download]")
      ?.focus({ preventScroll: true });
    const timer = setTimeout(() => setHighlighted(false), 1200);
    return () => clearTimeout(timer);
  }, [request]);
  const check = async () => {
    if (checking) return;
    setChecking(true);
    setResult(null);
    try {
      const response = await bridge.invoke("updates.checkNow", {});
      const next = response.ok ? response.data : { kind: "error" as const };
      setResult(next);
      if (next.kind === "available")
        useShellStore.setState({
          update: {
            version: next.version,
            html_url: next.url,
            installerUrl: next.installerUrl,
          },
        });
    } catch {
      setResult({ kind: "error" });
    } finally {
      setChecking(false);
    }
  };
  return (
    <SettingsRow
      ref={row}
      data-update-row
      data-highlighted={highlighted}
      className={`rounded-ld-md transition-[background-color,box-shadow] duration-160 ease-out motion-reduce:transition-none ${highlighted ? "bg-accent-soft ring-1 ring-inset ring-accent transition-none" : ""}`}
      label={t("settingsPage.checkUpdates")}
      description={t("settingsPage.checkUpdatesDescription")}
      descriptionId={descriptionId}
      status={
        <SettingsUpdateStatus
          bridge={bridge}
          version={version}
          checking={checking}
          result={result}
          update={update}
        />
      }
    >
      {enabled && (
        <IconButton
          label={t("settingsPage.checkNow")}
          disabled={checking}
          onClick={() => void check()}
        >
          <RefreshCw aria-hidden size={16} />
        </IconButton>
      )}
      <Switch
        aria-label={t("settingsPage.checkUpdates")}
        aria-describedby={descriptionId}
        checked={updatesCheck}
        onCheckedChange={(value) =>
          void bridge.invoke("settings.set", { key: "updates.check", value })
        }
      />
    </SettingsRow>
  );
}
