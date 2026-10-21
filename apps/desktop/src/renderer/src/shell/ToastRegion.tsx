import { Info, Toast, ToastProvider, ToastViewport } from "@lensdesk/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_OPEN_TABS } from "../../../shared/layout.ts";
import { useShellStore } from "../state/store.ts";
import { toolText } from "./tool-name.ts";

// Aviso del shell en la franja del encabezado: una sola línea y solo el más reciente; los demás
// (hasta 3 en cola) esperan y aparecen cuando el actual se cierra. Los mensajes, incluidos los que
// escribe una herramienta, se pintan siempre como texto plano: nunca se usa innerHTML.
export function ToastRegion({ bridge = window.lensdeskHost }: { bridge?: Window["lensdeskHost"] }) {
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [closing, setClosing] = useState<number | null>(null);
  const { t, i18n } = useTranslation();
  const toasts = useShellStore((state) => state.toasts);
  const tools = useShellStore((state) => state.tools);
  const removeToast = useShellStore((state) => state.removeToast);
  const toast = toasts.at(-1);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const closedTool = tools.find((candidate) => candidate.id === toast?.closedToolId);
  const message = toast?.closedToolId
    ? t("shell.tabClosedForLimit", {
        name: closedTool ? toolText(closedTool, i18n.resolvedLanguage).name : toast.closedToolId,
        count: MAX_OPEN_TABS,
      })
    : toast?.message;
  const tool = toast?.source ? tools.find((candidate) => candidate.id === toast.source) : undefined;
  const sourceName = toast?.source
    ? tool
      ? toolText(tool, i18n.resolvedLanguage).name
      : toast.source
    : null;
  // Un aviso de herramienta es siempre neutro: solo los del propio shell usan color de estado.
  const style = toast?.source ? undefined : toast?.kind;
  return (
    <ToastProvider duration={5000} label={t("ui.notifications")}>
      {toast && (
        <Toast
          className={`h-[34px] max-w-60 rounded-full text-[13px] shadow-none transition-opacity duration-200 ease-out motion-reduce:transition-none ${style === "error" ? "border-danger" : style === "success" ? "border-success" : ""}`}
          open
          style={{ animation: "none", opacity: closing === toast.id ? 0 : 1 }}
          role="status"
          onClickCapture={(event) => {
            if (
              (event.target as HTMLElement).closest("button")?.getAttribute("aria-label") ===
              t("ui.dismiss")
            )
              removeToast(toast.id);
          }}
          dismissLabel={t("ui.dismiss")}
          key={toast.id}
          onOpenChange={(open) => {
            if (!open) {
              setClosing(toast.id);
              clearTimeout(closeTimer.current);
              closeTimer.current = setTimeout(() => removeToast(toast.id), 200);
            }
          }}
          title={
            <span className="flex min-w-0 items-center gap-2">
              <Info aria-hidden size={15} className="shrink-0 text-accent" />
              <span className="min-w-0 truncate">
                {sourceName ? `${sourceName}: ${message}` : message}
              </span>
              {toast.closedToolId && (
                <button
                  type="button"
                  className="h-[26px] shrink-0 rounded-full bg-accent-soft px-2 font-semibold text-accent-soft-fg"
                  onClick={() => {
                    removeToast(toast.id);
                    void bridge.invoke("tabs.undoClose", { toolId: toast.closedToolId as string });
                  }}
                >
                  {t("shell.undoCloseTab")}
                </button>
              )}
            </span>
          }
          type={style === "error" ? "foreground" : "background"}
        />
      )}
      <ToastViewport className="w-full max-w-lg" label={t("ui.notifications")} />
    </ToastProvider>
  );
}
