import { Button, EmptyState } from "@lensdesk/ui";
import { type DragEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { useShellStore } from "../state/store.ts";
import { ToolCard } from "./ToolCard.tsx";
import { type ToolDialogState, ToolDialogs } from "./ToolDialogs.tsx";

export function ToolsPage({ bridge = window.lensdeskHost }: { bridge?: HostBridge } = {}) {
  const { t } = useTranslation();
  const tools = useShellStore((state) => state.tools);
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
    <main className="p-4" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <h1 className="text-[15px] font-medium">{t("toolsPage.title")}</h1>
      {tools.length === 0 ? (
        <EmptyState
          title={t("toolsPage.emptyTitle")}
          description={t("toolsPage.emptyDescription")}
          action={
            <Button onClick={() => void install("tools.pickAndInstall")}>
              {t("toolsPage.addTool")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="my-3 flex justify-end">
            <Button onClick={() => void install("tools.pickAndInstall")}>
              {t("toolsPage.addTool")}
            </Button>
          </div>
          <section
            aria-label={t("toolsPage.title")}
            className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3"
          >
            {tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
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
        </>
      )}
      <ToolDialogs
        state={dialog}
        pending={pending}
        bridge={bridge}
        onClose={() => setDialog(null)}
        onError={showError}
      />
    </main>
  );
}
