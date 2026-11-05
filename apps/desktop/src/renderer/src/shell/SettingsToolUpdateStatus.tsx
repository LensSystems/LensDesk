import { Check, CircleAlert, TriangleAlert } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { HostBridge, UpdateSources } from "../../../shared/host-channels.ts";
import { useShellStore } from "../state/store.ts";
import { installedUpdates } from "../state/update-state.ts";
import { updateLinkClass } from "./SettingsAppUpdateStatus.tsx";
import { toolText } from "./tool-name.ts";

export function SettingsToolUpdateStatus({
  bridge,
  source,
}: {
  bridge: HostBridge;
  source: UpdateSources["tools"];
}) {
  const { t, i18n } = useTranslation();
  const tools = useShellStore((state) => state.tools);
  const showPage = useShellStore((state) => state.showPage);
  const updates = installedUpdates(source.updates, tools);
  const incompatible = installedUpdates(source.incompatible, tools);
  const first = incompatible[0];
  const tool = tools.find((tool) => tool.id === first?.id);
  const name = tool ? toolText(tool, i18n.resolvedLanguage).name : (first?.id ?? "");
  const previous = source.status !== "success";
  return (
    <span className="flex min-w-0 flex-col gap-2">
      {source.status === "error" ? (
        <span className="flex items-start gap-2 text-danger">
          <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
          <span>{t("settingsPage.toolsUpdateError")}</span>
        </span>
      ) : source.status === "not-checked" ? (
        <span className="text-muted">{t("settingsPage.toolsNotChecked")}</span>
      ) : null}
      {previous && (updates.length > 0 || incompatible.length > 0) && (
        <span className="font-normal text-muted">{t("settingsPage.previousResults")}</span>
      )}
      {updates.length > 0 ? (
        // biome-ignore lint/a11y/useValidAnchor: This link navigates to a host page; IPC coordinates the view and heading focus.
        <a
          href="#tools"
          className={`${updateLinkClass} self-start max-w-full`}
          onClick={(event) => {
            event.preventDefault();
            void showPage(bridge, "tools");
          }}
        >
          {t("settingsPage.toolUpdates", { count: updates.length })}
        </a>
      ) : incompatible.length === 0 && source.status === "success" ? (
        <span className="flex items-start gap-2 text-success">
          <Check aria-hidden size={16} className="mt-0.5 shrink-0" />
          <span>{t("settingsPage.toolsUpToDate")}</span>
        </span>
      ) : null}
      {first && (
        // biome-ignore lint/a11y/useValidAnchor: This link navigates to a host page; IPC coordinates the view and heading focus.
        <a
          href="#tools"
          className="inline-flex min-w-0 max-w-full self-start items-start gap-2 rounded-ld-sm text-warning underline ld-update-link"
          onClick={(event) => {
            event.preventDefault();
            void showPage(bridge, "tools");
          }}
        >
          <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {incompatible.length > 1
              ? t("settingsPage.toolsIncompatible", { count: incompatible.length })
              : t(
                  first.reasons.includes("apiVersion")
                    ? "settingsPage.toolIncompatibleApi"
                    : "settingsPage.toolIncompatibleHost",
                  { name, version: first.minHostVersion },
                )}
          </span>
        </a>
      )}
    </span>
  );
}
