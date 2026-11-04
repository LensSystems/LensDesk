import { Notice } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { SettingsAction, SettingsActionState } from "./use-settings-actions.ts";

export function SettingsActionStatus({
  action,
  state,
  label,
  targetId,
}: {
  action: SettingsAction;
  state?: SettingsActionState;
  label?: string;
  targetId: string;
}) {
  const { t } = useTranslation();
  const retry = () => {
    const target = document.getElementById(targetId);
    const control =
      document.getElementById(`${targetId}-control`) ??
      target?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]');
    (control ?? target)?.focus();
    state?.retry();
  };
  return (
    <div>
      {state?.pending ? (
        <p role="status" className="mt-1 text-[13px] text-muted">
          {t(
            `settingsPage.${action === "info" ? "loadingInfo" : action === "folder" ? "openingFolder" : "savingSetting"}`,
            { setting: label },
          )}
        </p>
      ) : state?.error ? (
        <Notice
          className="mt-2 flex-wrap"
          tone="danger"
          title={t(
            `settingsPage.${action === "info" ? "infoError" : action === "folder" ? "openFolderError" : "settingError"}`,
            { setting: label },
          )}
          action={{ label: t("settingsPage.retryAction"), onClick: retry }}
        />
      ) : null}
    </div>
  );
}
