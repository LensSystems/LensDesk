import { LoaderCircle, SwapText } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type {
  HostBridge,
  HostEventPayloads,
  UpdateSources,
} from "../../../shared/host-channels.ts";
import { SettingsAppUpdateStatus } from "./SettingsAppUpdateStatus.tsx";
import { SettingsToolUpdateStatus } from "./SettingsToolUpdateStatus.tsx";

type Props = {
  bridge: HostBridge;
  version: string;
  checking: boolean;
  sources: UpdateSources | null;
  update: HostEventPayloads["update.available"] | null;
  enabled: boolean;
};
export function SettingsUpdateStatus({
  bridge,
  version,
  checking,
  sources,
  update,
  enabled,
}: Props) {
  const { t, i18n } = useTranslation();
  if (!checking && !sources && !update) return null;
  const current = sources ?? {
    app: { status: "success" as const, update },
    tools: { status: "not-checked" as const, updates: [], incompatible: [] },
  };
  const state: UpdateSources = enabled
    ? current
    : {
        app: { ...current.app, status: "not-checked" },
        tools: { ...current.tools, status: "not-checked" },
      };
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="ld-selectable mt-2 min-w-0 [overflow-wrap:anywhere] text-[13px] leading-5 font-semibold text-muted"
    >
      <SwapText
        className="w-full min-w-0"
        value={
          checking
            ? `checking:${i18n.resolvedLanguage}`
            : JSON.stringify([state, version, i18n.resolvedLanguage])
        }
      >
        {checking ? (
          <span className="flex min-w-0 items-start gap-2">
            <LoaderCircle
              aria-hidden
              size={16}
              className="mt-0.5 shrink-0 animate-spin motion-reduce:animate-none"
            />
            <span>{t("settingsPage.checking")}</span>
          </span>
        ) : (
          <span className="flex w-full min-w-0 flex-col gap-2">
            <SettingsAppUpdateStatus bridge={bridge} version={version} source={state.app} />
            {sources && <SettingsToolUpdateStatus bridge={bridge} source={state.tools} />}
          </span>
        )}
      </SwapText>
    </div>
  );
}
