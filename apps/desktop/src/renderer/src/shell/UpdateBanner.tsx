import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostEventPayloads } from "../../../shared/host-channels.ts";

type Props = {
  update: HostEventPayloads["update.available"];
  bridge: Window["lensdeskHost"];
  onDismiss: () => void;
};

export function UpdateBanner({ update, bridge, onDismiss }: Props) {
  const { t } = useTranslation();
  const [opening, setOpening] = useState(false);
  if (opening) return null;
  return (
    <aside
      className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2"
      role="status"
    >
      <span>{t("recovery.updateAvailable", { version: update.version })}</span>
      <div className="flex gap-2">
        <button
          className="h-7 rounded bg-accent px-3 text-accent-fg"
          onClick={() => void bridge.invoke("app.openExternal", { url: update.html_url })}
          type="button"
        >
          {t("recovery.viewUpdate")}
        </button>
        <button
          aria-label={t("ui.dismiss")}
          className="h-7 rounded border border-border px-2"
          onClick={() => {
            setOpening(true);
            onDismiss();
          }}
          type="button"
        >
          {t("ui.dismiss")}
        </button>
      </div>
    </aside>
  );
}
