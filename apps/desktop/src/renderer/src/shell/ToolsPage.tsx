import { Button, EmptyState, Plus, Puzzle } from "@lensdesk/ui";
import { type DragEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { useShellStore } from "../state/store.ts";
import { PageFrame } from "./PageFrame.tsx";
import { ToolCard } from "./ToolCard.tsx";
import { type ToolDialogState, ToolDialogs } from "./ToolDialogs.tsx";
import { ToolUpdateGuide } from "./ToolUpdateGuide.tsx";

export function ToolsPage({ bridge = window.lensdeskHost }: { bridge?: HostBridge } = {}) {
  const { t } = useTranslation();
  const tools = useShellStore((state) => state.tools);
  const updates = useShellStore((state) => state.toolUpdates);
  const pending = useShellStore((state) => state.pendingDowngrade);
  const [dialog, setDialog] = useState<ToolDialogState>(null);
  const install = async (
    channel: "tools.pickAndInstall" | "tools.installFromPath",
    payload: { path?: string } = {},
  ) => {
    const result = await bridge.invoke(
      channel,
      channel === "tools.pickAndInstall" ? {} : { path: payload.path ?? "" },
    );
    if (!result.ok && result.error.code === "E_DOWNGRADE_CONFIRM") return;
    if (!result.ok) setDialog({ kind: "error", code: result.error.code, install: true });
  };
  const showError = (code: string, installing: boolean) =>
    setDialog({ kind: "error", code, install: installing });
  const act = async (call: () => ReturnType<HostBridge["invoke"]>) => {
    const result = await call();
    if (!result.ok) showError(result.error.code, false);
  };
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    for (const file of Array.from(event.dataTransfer.files)) {
      if (!file.name.toLowerCase().endsWith(".lenspkg")) continue;
      void install("tools.installFromPath", { path: bridge.pathForFile(file) });
    }
  };
  return (
    <PageFrame onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">
            {t("toolsPage.title")}
          </h1>
          <p className="text-muted">{t("toolsPage.subtitle")}</p>
        </div>
        {tools.length > 0 && (
          <Button
            aria-label={t("toolsPage.addTool")}
            variant="primary"
            size="lg"
            onClick={() => void install("tools.pickAndInstall")}
          >
            <Plus aria-hidden size={16} className="@min-[48rem]:hidden" />
            <span className="@min-[48rem]:hidden">{t("toolsPage.addToolCompact")}</span>
            <span className="hidden @min-[48rem]:inline">{t("toolsPage.addTool")}</span>
          </Button>
        )}
      </div>
      {tools.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Puzzle aria-hidden size={44} className="text-muted" />
          <EmptyState
            title={t("toolsPage.emptyTitle")}
            description={t("toolsPage.emptyDescription")}
            action={
              <Button
                variant="primary"
                size="lg"
                onClick={() => void install("tools.pickAndInstall")}
              >
                <Plus aria-hidden size={16} />
                {t("toolsPage.addTool")}
              </Button>
            }
          />
          <p className="text-sm text-muted">{t("toolsPage.chooseFile")}</p>
        </div>
      ) : (
        <section
          aria-label={t("toolsPage.title")}
          className="grid grid-cols-2 items-stretch gap-4 @min-[48rem]:items-start @min-[68rem]:grid-cols-3"
        >
          {tools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              bridge={bridge}
              onInstall={() => void install("tools.pickAndInstall")}
              update={updates.find((update) => update.id === tool.id)}
              onOpen={() => void act(() => bridge.invoke("tabs.open", { toolId: tool.id }))}
              actions={{
                enabled: () =>
                  void act(() =>
                    bridge.invoke("tools.setEnabled", {
                      toolId: tool.id,
                      enabled: !tool.enabled,
                    }),
                  ),
                details: () => setDialog({ kind: "details", tool }),
                remove: () => setDialog({ kind: "remove", tool }),
              }}
            />
          ))}
        </section>
      )}
      {tools.some((tool) => updates.some((update) => update.id === tool.id)) && <ToolUpdateGuide />}
      <ToolDialogs
        state={dialog}
        update={updates.find(
          (update) => dialog && "tool" in dialog && update.id === dialog.tool.id,
        )}
        onInstall={() => {
          setDialog(null);
          void install("tools.pickAndInstall");
        }}
        pending={pending}
        bridge={bridge}
        onClose={() => setDialog(null)}
        onError={showError}
      />
    </PageFrame>
  );
}
