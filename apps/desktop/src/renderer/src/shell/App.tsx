import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { applyContext } from "../apply-context.ts";
import { useShellStore } from "../state/store.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { TabBar } from "./TabBar.tsx";
import { ToolCrashed } from "./ToolCrashed.tsx";
import { ToolsPage } from "./ToolsPage.tsx";
import { UpdateBanner } from "./UpdateBanner.tsx";

type AppProps = { bridge?: Window["lensdeskHost"] };

export function App({ bridge = window.lensdeskHost }: AppProps) {
  const { i18n, t } = useTranslation();
  const tabs = useShellStore((state) => state.tabs);
  const page = useShellStore((state) => state.page);
  const context = useShellStore((state) => state.context);
  const update = useShellStore((state) => state.update);
  const crashedToolId = useShellStore((state) => state.crashedToolId);
  useEffect(() => {
    const unsubscribe = useShellStore.getState().subscribe(bridge);
    void useShellStore.getState().hydrate(bridge);
    return unsubscribe;
  }, [bridge]);
  useEffect(() => {
    void i18n.changeLanguage(context.locale);
    applyContext(context, document.documentElement);
  }, [context, i18n]);
  return (
    <ErrorBoundary
      title={t("recovery.errorTitle")}
      description={t("recovery.errorDescription")}
      reloadLabel={t("recovery.reload")}
    >
      <div className="min-h-screen bg-bg text-text">
        {update && (
          <UpdateBanner
            bridge={bridge}
            onDismiss={() => useShellStore.setState({ update: null })}
            update={update}
          />
        )}
        <TabBar tabs={tabs} bridge={bridge} />
        {page === "settings" ? (
          <SettingsPage bridge={bridge} />
        ) : page === "tab" ? (
          crashedToolId && tabs.some((tab) => tab.active && tab.toolId === crashedToolId) ? (
            <ToolCrashed bridge={bridge} toolId={crashedToolId} />
          ) : (
            <main aria-label={t("shell.activeTool")} />
          )
        ) : (
          <ToolsPage />
        )}
      </div>
    </ErrorBoundary>
  );
}
