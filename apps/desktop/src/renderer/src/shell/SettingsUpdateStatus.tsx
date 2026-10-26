import { Check, CircleAlert, Download, ExternalLink, LoaderCircle, SwapText } from "@lensdesk/ui";
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
  const linkClass =
    "inline-flex items-center gap-2 rounded-ld-sm text-accent underline ld-update-link";
  if (!checking && !update && result?.kind !== "none" && result?.kind !== "error") return null;
  return (
    <div
      role="status"
      className="ld-selectable mt-2 flex items-center gap-4 text-[13px] leading-5 font-semibold text-muted empty:hidden"
    >
      <SwapText
        className="gap-4"
        value={JSON.stringify([checking, result, update, version, t("settingsPage.checking")])}
      >
        {checking && (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle
              aria-hidden
              size={16}
              className="animate-spin motion-reduce:animate-none"
            />
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
              <Download aria-hidden size={16} />
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
              <ExternalLink aria-hidden size={16} className="ld-update-arrow" />
              {t("recovery.viewUpdate")}
            </a>
          </>
        ) : !checking && result?.kind === "none" ? (
          <span className="inline-flex items-center gap-2 text-success">
            <Check aria-hidden size={16} />
            {t("settingsPage.upToDate", { version })}
          </span>
        ) : !checking && result?.kind === "error" ? (
          <span className="inline-flex items-center gap-2 text-danger">
            <CircleAlert aria-hidden size={16} />
            {t("settingsPage.updateError")}
          </span>
        ) : null}
      </SwapText>
    </div>
  );
}
