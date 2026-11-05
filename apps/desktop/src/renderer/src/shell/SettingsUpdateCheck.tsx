import { IconButton, RefreshCw, Switch } from "@lensdesk/ui";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { useShellStore } from "../state/store.ts";
import { SettingsRow } from "./SettingsRow.tsx";
import { SettingsUpdateStatus } from "./SettingsUpdateStatus.tsx";

type Props = { bridge: HostBridge; version: string; enabled: boolean; ready?: boolean };

export function SettingsUpdateCheck({ bridge, version, enabled, ready = true }: Props) {
  const { t } = useTranslation();
  const descriptionId = useId();
  const row = useRef<HTMLDivElement>(null);
  const update = useShellStore((state) => state.update);
  const request = useShellStore((state) => state.updateSettingsRequest);
  const updatesCheck = useShellStore((state) => state.settings.updatesCheck);
  const sources = useShellStore((state) => state.updateSources);
  const checking = useShellStore((state) => state.updateChecking);
  const checkUpdates = useShellStore((state) => state.checkUpdates);
  const [highlighted, setHighlighted] = useState(false);
  const focusedRequest = useRef(0);
  useEffect(() => {
    if (!request) return;
    setHighlighted(true);
    row.current?.scrollIntoView?.({ block: "nearest" });
    const timer = setTimeout(() => setHighlighted(false), 1200);
    return () => clearTimeout(timer);
  }, [request]);
  useEffect(() => {
    // Wait for app info so the requested destination control exists on a fresh page.
    // Later toggles/retries must not steal focus from the user's current control.
    if (!request || focusedRequest.current === request) return;
    // A known app link already exists before app.getInfo completes; preserve its focus.
    const download = row.current?.querySelector<HTMLElement>(
      "[data-update-download]:not([inert] *)",
    );
    if (!download && !ready) return;
    focusedRequest.current = request;
    const target =
      download ??
      row.current?.querySelector<HTMLElement>(
        "[data-update-check]:not(:disabled), [data-update-toggle]",
      );
    target?.focus({ preventScroll: true });
  }, [request, ready]);
  return (
    <SettingsRow
      controlsClassName="gap-3"
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
          sources={sources}
          enabled={enabled}
          update={update}
        />
      }
    >
      {enabled && (
        <IconButton
          data-update-check
          label={t("settingsPage.checkNow")}
          disabled={checking}
          onClick={() => void checkUpdates(bridge)}
        >
          <RefreshCw aria-hidden size={16} />
        </IconButton>
      )}
      <Switch
        data-update-toggle
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
