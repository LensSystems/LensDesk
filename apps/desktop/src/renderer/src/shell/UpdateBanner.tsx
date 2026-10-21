import { Button, ExternalLink, IconButton, X } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { HostEventPayloads } from "../../../shared/host-channels.ts";

type Props = {
  update: HostEventPayloads["update.available"];
  bridge: Window["lensdeskHost"];
  onDismiss: () => void;
};

// Aviso compacto dentro del encabezado: una línea, sin empujar el contenido. Las acciones
// secundarias son iconos con etiqueta para que quepa junto a los botones de la cabecera.
export function UpdateBanner({ update, bridge, onDismiss }: Props) {
  const { t } = useTranslation();
  return (
    <div
      className="flex h-8 min-w-0 items-center gap-1 rounded-full bg-accent-soft pl-3 pr-1 text-xs text-accent-soft-fg"
      role="status"
    >
      <span className="truncate">
        <span aria-hidden>{t("recovery.updateShort", { version: update.version })}</span>
        <span className="sr-only">
          {t("recovery.updateAvailable", { version: update.version })}
        </span>
      </span>
      <Button
        variant="primary"
        aria-label={t("recovery.downloadInstaller")}
        className="ld-no-drag h-6 shrink-0 px-2 text-xs"
        onClick={() =>
          void bridge.invoke("app.openExternal", { url: update.installerUrl ?? update.html_url })
        }
        type="button"
      >
        {t("recovery.download")}
      </Button>
      <IconButton
        className="ld-no-drag size-6 shrink-0 text-accent-soft-fg"
        label={t("recovery.viewUpdate")}
        tooltipSide="bottom"
        onClick={() => void bridge.invoke("app.openExternal", { url: update.html_url })}
      >
        <ExternalLink aria-hidden size={14} />
      </IconButton>
      <IconButton
        className="ld-no-drag size-6 shrink-0 text-accent-soft-fg"
        label={t("ui.dismiss")}
        tooltipSide="bottom"
        onClick={onDismiss}
      >
        <X aria-hidden size={14} />
      </IconButton>
    </div>
  );
}
