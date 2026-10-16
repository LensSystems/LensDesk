import { useTranslation } from "react-i18next";
import type { HostEventPayloads } from "../../../shared/host-channels.ts";

type Props = {
  update: HostEventPayloads["update.available"];
  bridge: Window["lensdeskHost"];
  onDismiss: () => void;
};

// Aviso compacto dentro del encabezado de 36 px: una línea, sin empujar el contenido.
export function UpdateBanner({ update, bridge, onDismiss }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex h-7 min-w-0 items-center gap-1 text-xs" role="status">
      <span className="truncate">{t("recovery.updateAvailable", { version: update.version })}</span>
      <button
        className="h-6 shrink-0 rounded bg-accent px-2 text-accent-fg"
        onClick={() => void bridge.invoke("app.openExternal", { url: update.html_url })}
        type="button"
      >
        {t("recovery.viewUpdate")}
      </button>
      <button
        className="h-6 shrink-0 rounded border border-border px-2"
        onClick={onDismiss}
        type="button"
      >
        {t("ui.dismiss")}
      </button>
    </div>
  );
}
