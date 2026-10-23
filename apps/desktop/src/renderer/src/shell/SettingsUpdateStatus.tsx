import { Check, CircleAlert, Download, ExternalLink, LoaderCircle } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type {
  HostBridge,
  HostEventPayloads,
  UpdateCheckResult,
} from "../../../shared/host-channels.ts";

type Props = {
  bridge: HostBridge;
  version: string;
  checking: boolean;
  result: UpdateCheckResult | null;
  update: HostEventPayloads["update.available"] | null;
};

export function SettingsUpdateStatus({ bridge, version, checking, result, update }: Props) {
  const { t } = useTranslation();
  const linkClass = "inline-flex items-center gap-2 rounded-ld-sm text-accent hover:underline";
  if (!checking && !update && result?.kind !== "none" && result?.kind !== "error") return null;
  return (
    <div
      role="status"
      className="ld-selectable mt-2 flex items-center gap-4 text-[13px] font-semibold text-muted empty:hidden"
    >
      {checking && (
        <span className="inline-flex items-center gap-2">
          <LoaderCircle aria-hidden size={14} className="animate-spin motion-reduce:animate-none" />
          {t("settingsPage.checking")}
        </span>
      )}
      {update ? (
        <>
          <a
            data-update-download
            href={update.installerUrl ?? update.html_url}
            className={linkClass}
            onClick={(event) => {
              event.preventDefault();
              void bridge.invoke("app.openExternal", {
                url: update.installerUrl ?? update.html_url,
              });
            }}
          >
            <Download aria-hidden size={14} />
            {t("settingsPage.updateAvailable", { version: update.version })}
          </a>
          <a
            href={update.html_url}
            className={linkClass}
            onClick={(event) => {
              event.preventDefault();
              void bridge.invoke("app.openExternal", { url: update.html_url });
            }}
          >
            <ExternalLink aria-hidden size={14} />
            {t("recovery.viewUpdate")}
          </a>
        </>
      ) : !checking && result?.kind === "none" ? (
        <span className="inline-flex items-center gap-2 text-success">
          <Check aria-hidden size={14} />
          {t("settingsPage.upToDate", { version })}
        </span>
      ) : !checking && result?.kind === "error" ? (
        <span className="inline-flex items-center gap-2 text-danger">
          <CircleAlert aria-hidden size={14} />
          {t("settingsPage.updateError")}
        </span>
      ) : null}
    </div>
  );
}
