import { TriangleAlert } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { HostBridge, IncompatibleToolUpdate } from "../../../shared/host-channels.ts";
import { useShellStore } from "../state/store.ts";

export function ToolCompatibilityNotice({
  incompatible,
  bridge,
}: {
  incompatible: IncompatibleToolUpdate;
  bridge: HostBridge;
}) {
  const { t } = useTranslation();
  const showSettings = useShellStore((state) => state.showUpdateSettings);
  const api = incompatible.reasons.includes("apiVersion");
  return (
    <div className="min-w-0 space-y-2 [overflow-wrap:anywhere] text-[13px] leading-5 text-warning">
      <p className="flex items-start gap-2 font-semibold">
        <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
        <span>
          {t(api ? "toolsPage.incompatibleApiTitle" : "toolsPage.incompatibleHostTitle", {
            version: incompatible.version,
          })}
        </span>
      </p>
      <p>
        {t(api ? "toolsPage.incompatibleApi" : "toolsPage.incompatibleHost", {
          version: incompatible.minHostVersion,
        })}
      </p>
      {/* biome-ignore lint/a11y/useValidAnchor: This link navigates to the host Settings page and focuses its update row. */}
      <a
        href="#settings-updates"
        className="inline-flex rounded-ld-sm text-accent underline ld-update-link"
        onClick={(event) => {
          event.preventDefault();
          void showSettings(bridge);
        }}
      >
        {t("recovery.goToSettings")}
      </a>
    </div>
  );
}
