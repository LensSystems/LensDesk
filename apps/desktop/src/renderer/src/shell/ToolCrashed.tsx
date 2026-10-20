import { Button, RotateCw, TriangleAlert } from "@lensdesk/ui";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { HEADER_HEIGHT } from "../../../shared/layout.ts";
import { useShellStore } from "../state/store.ts";
import { toolText } from "./tool-name.ts";

export function ToolCrashed({ toolId, bridge }: { toolId: string; bridge: HostBridge }) {
  const { t, i18n } = useTranslation();
  const tool = useShellStore((state) => state.tools.find((item) => item.id === toolId));
  const name = tool ? toolText(tool, i18n.language).name : toolId;
  const [retrying, setRetrying] = useState(false);
  const retryStarted = useRef(false);
  const retry = async () => {
    if (retryStarted.current) return;
    retryStarted.current = true;
    setRetrying(true);
    await bridge.invoke("tabs.close", { toolId });
    await bridge.invoke("tabs.open", { toolId });
    useShellStore.setState({ crashedToolId: null });
  };
  return (
    <main
      aria-label={t("shell.activeTool")}
      style={{ height: `calc(100dvh - ${HEADER_HEIGHT}px - 12px)` }}
      className="mx-3 mb-3 grid min-h-0 place-items-center overflow-y-auto rounded-ld-lg border border-border bg-surface p-4 text-text"
    >
      <div className="flex w-full max-w-100 flex-col items-center gap-4 text-center">
        <div
          aria-hidden="true"
          className="grid size-16 shrink-0 place-items-center rounded-ld-xl bg-warning-soft text-warning-soft-fg"
        >
          <TriangleAlert size={30} strokeWidth={1.6} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold">{t("recovery.toolCrashedTitle", { name })}</h1>
          <p className="text-muted">{t("recovery.toolCrashedDescription")}</p>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          disabled={retrying}
          onClick={() => void retry()}
          type="button"
        >
          <RotateCw size={16} aria-hidden="true" />
          {t("recovery.retry")}
        </Button>
      </div>
    </main>
  );
}
