import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { useShellStore } from "../state/store.ts";
import { toolText } from "./tool-name.ts";

export function ToolCrashed({ toolId, bridge }: { toolId: string; bridge: HostBridge }) {
  const { t, i18n } = useTranslation();
  const tool = useShellStore((state) => state.tools.find((item) => item.id === toolId));
  const name = tool ? toolText(tool, i18n.language).name : toolId;
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    await bridge.invoke("tabs.close", { toolId });
    await bridge.invoke("tabs.open", { toolId });
    useShellStore.setState({ crashedToolId: null });
  };
  return (
    <main className="grid min-h-64 place-content-center gap-3 p-4 text-text">
      <h1 className="text-[15px] font-medium">{t("recovery.toolCrashedTitle", { name })}</h1>
      <p className="text-muted">{t("recovery.toolCrashedDescription")}</p>
      <button
        className="h-7 rounded bg-accent px-3 text-accent-fg"
        disabled={retrying}
        onClick={() => void retry()}
        type="button"
      >
        {t("recovery.retry")}
      </button>
    </main>
  );
}
