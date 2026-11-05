import { Check, CircleAlert, Download, ExternalLink } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { HostBridge, UpdateSources } from "../../../shared/host-channels.ts";

export const updateLinkClass =
  "inline-flex min-w-0 items-center gap-2 rounded-ld-sm text-accent underline ld-update-link";
export function SettingsAppUpdateStatus({
  bridge,
  version,
  source,
}: {
  bridge: HostBridge;
  version: string;
  source: UpdateSources["app"];
}) {
  const { t } = useTranslation();
  const previous = source.status !== "success";
  return (
    <span className="flex min-w-0 flex-col gap-2">
      {source.status === "error" ? (
        <span className="flex items-start gap-2 text-danger">
          <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
          <span>{t("settingsPage.updateError")}</span>
        </span>
      ) : source.status === "not-checked" ? (
        <span className="text-muted">{t("settingsPage.appNotChecked")}</span>
      ) : !source.update ? (
        <span className="flex items-start gap-2 text-success">
          <Check aria-hidden size={16} className="mt-0.5 shrink-0" />
          <span>{t("settingsPage.upToDate", { version })}</span>
        </span>
      ) : null}
      {source.update && (
        <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          {previous && (
            <span className="w-full font-normal text-muted">
              {t("settingsPage.previousResults")}
            </span>
          )}
          <a
            data-update-download
            href={source.update.installerUrl ?? source.update.html_url}
            className={updateLinkClass}
            onClick={(event) => {
              event.preventDefault();
              void bridge.invoke("app.openExternal", {
                url: source.update?.installerUrl ?? source.update?.html_url ?? "",
              });
            }}
          >
            <Download aria-hidden size={16} className="shrink-0" />
            <span>{t("settingsPage.updateAvailable", { version: source.update.version })}</span>
          </a>
          <a
            href={source.update.html_url}
            className={updateLinkClass}
            onClick={(event) => {
              event.preventDefault();
              if (source.update)
                void bridge.invoke("app.openExternal", { url: source.update.html_url });
            }}
          >
            <ExternalLink aria-hidden size={16} className="ld-update-arrow shrink-0" />
            {t("recovery.viewUpdate")}
          </a>
        </span>
      )}
    </span>
  );
}
