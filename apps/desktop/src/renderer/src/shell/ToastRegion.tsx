import { Toast, ToastProvider, ToastViewport } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { useShellStore } from "../state/store.ts";
import { toolText } from "./tool-name.ts";

// Aviso del shell en la franja del encabezado: una sola línea y solo el más reciente; los demás
// (hasta 3 en cola) esperan y aparecen cuando el actual se cierra. Los mensajes, incluidos los que
// escribe una herramienta, se pintan siempre como texto plano: nunca se usa innerHTML.
export function ToastRegion() {
  const { t, i18n } = useTranslation();
  const toasts = useShellStore((state) => state.toasts);
  const tools = useShellStore((state) => state.tools);
  const removeToast = useShellStore((state) => state.removeToast);
  const toast = toasts.at(-1);
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
          className={`rounded-full shadow-none transition-colors duration-150 ease-out motion-reduce:transition-none ${style === "error" ? "border-danger" : style === "success" ? "border-success" : ""}`}
          dismissLabel={t("ui.dismiss")}
          key={toast.id}
          onOpenChange={(open) => {
            if (!open) removeToast(toast.id);
          }}
          title={sourceName ? `${sourceName}: ${toast.message}` : toast.message}
          type={style === "error" ? "foreground" : "background"}
        />
      )}
      <ToastViewport label={t("ui.notifications")} />
    </ToastProvider>
  );
}
