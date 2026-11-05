import { CircleAlert } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { UpdateSourceStatus } from "../../../shared/host-channels.ts";

export function ToolUpdateSourceNotice({
  status,
  previous,
}: {
  status?: UpdateSourceStatus;
  previous: boolean;
}) {
  const { t } = useTranslation();
  if (!status || status === "success") return null;
  return (
    <p
      role="status"
      className={`flex items-start gap-2 text-[13px] leading-5 ${status === "error" ? "text-danger" : "text-muted"}`}
    >
      {status === "error" && <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />}
      <span>
        {t(status === "error" ? "settingsPage.toolsUpdateError" : "settingsPage.toolsNotChecked")}
        {previous ? ` ${t("settingsPage.previousResults")}` : ""}
      </span>
    </p>
  );
}
