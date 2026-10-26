import { Info, Toast, ToastProvider, ToastViewport } from "@lensdesk/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShellStore } from "../state/store.ts";
import { ClosedTabNotice } from "./ClosedTabNotice.tsx";
import { toolText } from "./tool-name.ts";

// Aviso del shell en la franja del encabezado: una sola línea y solo el más reciente; los demás
// (hasta 3 en cola) esperan y aparecen cuando el actual se cierra. Los mensajes, incluidos los que
// escribe una herramienta, se pintan siempre como texto plano: nunca se usa innerHTML.
export function ToastRegion({
  bridge = window.lensdeskHost,
  paused,
  stacked = false,
}: {
  bridge?: Window["lensdeskHost"];
  paused?: boolean;
  stacked?: boolean;
}) {
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [closing, setClosing] = useState<number | null>(null);
  const { t, i18n } = useTranslation();
  const toasts = useShellStore((state) => state.toasts);
  const tools = useShellStore((state) => state.tools);
  const removeToast = useShellStore((state) => state.removeToast);
  const toast = toasts.at(-1);
  const remaining = useRef(5000);
  // Como antes, el aviso no caduca mientras la ventana no tiene el foco.
  const [away, setAway] = useState(false);
  useEffect(() => {
    const blur = () => setAway(true);
    const focus = () => setAway(false);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
    };
  }, []);
  useEffect(() => {
    if (toast?.id !== undefined) remaining.current = 5000;
  }, [toast?.id]);
  useEffect(() => {
    if (!toast || toast.closedToolId || paused || away || paused === undefined) return;
    const started = Date.now();
    const timer = setTimeout(() => {
      setClosing(toast.id);
      closeTimer.current = setTimeout(
        () => removeToast(toast.id),
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : stacked ? 160 : 200,
      );
    }, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [toast, paused, away, stacked, removeToast]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const closedTool = tools.find((candidate) => candidate.id === toast?.closedToolId);
  const openedTool = tools.find((candidate) => candidate.id === toast?.openedToolId);
  const message = toast?.closedToolId
    ? t("shell.tabClosedForLimit", {
        closed: closedTool ? toolText(closedTool, i18n.resolvedLanguage).name : toast.closedToolId,
        opened: openedTool
          ? toolText(openedTool, i18n.resolvedLanguage).name
          : (toast.openedToolId ?? ""),
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
  if (!toast) return null;
  if (toast.closedToolId)
    return (
      <ol className="w-full min-w-0" aria-label={t("ui.notifications")}>
        <ClosedTabNotice
          stackPaused={paused}
          stacked={stacked}
          key={toast.id}
          message={message ?? ""}
          onRemove={() => removeToast(toast.id)}
          onUndo={() => {
            removeToast(toast.id);
            void bridge.invoke("tabs.undoClose", { toolId: toast.closedToolId as string });
          }}
        />
      </ol>
    );
  return (
    <ToastProvider duration={paused === undefined ? 5000 : Infinity} label={t("ui.notifications")}>
      <Toast
        className={`h-[34px] max-w-60 rounded-full text-[13px] shadow-none transition-opacity duration-200 ease-out motion-reduce:transition-none ${style === "error" ? "border-danger" : style === "success" ? "border-success" : ""}`}
        open
        data-stack-motion={stacked}
        data-closing={closing === toast.id}
        style={{ animation: "none", opacity: closing === toast.id ? 0 : 1 }}
        role="status"
        onClickCapture={(event) => {
          if (
            (event.target as HTMLElement).closest("button")?.getAttribute("aria-label") ===
            t("ui.dismiss")
          ) {
            if (!stacked) {
              removeToast(toast.id);
              return;
            }
            event.preventDefault();
            setClosing(toast.id);
            clearTimeout(closeTimer.current);
            closeTimer.current = setTimeout(
              () => removeToast(toast.id),
              window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
                ? 0
                : stacked
                  ? 160
                  : 200,
            );
          }
        }}
        dismissLabel={t("ui.dismiss")}
        key={toast.id}
        onOpenChange={(open) => {
          if (!open) {
            setClosing(toast.id);
            clearTimeout(closeTimer.current);
            closeTimer.current = setTimeout(() => removeToast(toast.id), stacked ? 160 : 200);
          }
        }}
        title={
          <span className="flex min-w-0 items-center gap-2">
            <Info aria-hidden size={15} className="shrink-0 text-accent" />
            <span className="min-w-0 truncate">
              {sourceName ? `${sourceName}: ${message}` : message}
            </span>
          </span>
        }
        type={style === "error" ? "foreground" : "background"}
      />
      <ToastViewport className="w-full max-w-lg" label={t("ui.notifications")} />
    </ToastProvider>
  );
}
