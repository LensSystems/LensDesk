import { Button, IconButton, X } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { HostEventPayloads } from "../../../shared/host-channels.ts";

import { NoticeCapsule } from "./NoticeCapsule.tsx";

type Props = {
  update: HostEventPayloads["update.available"];
  onOpenSettings: () => void;
  onDismiss: () => void;
};

export function UpdateBanner({ update, onOpenSettings, onDismiss }: Props) {
  const { t } = useTranslation();
  return (
    <NoticeCapsule status text={t("recovery.updateAvailable", { version: update.version })}>
      <Button
        variant="primary"
        aria-label={t("recovery.goToSettings")}
        className="ld-no-drag h-6 w-20 shrink-0 border-0 px-2 text-xs leading-4 font-bold"
        onClick={onOpenSettings}
        type="button"
      >
        {t("recovery.goToSettings")}
      </Button>
      <IconButton
        className="ld-no-drag size-6 shrink-0 text-accent-soft-fg"
        label={t("ui.dismiss")}
        tooltipSide="bottom"
        onClick={onDismiss}
      >
        <X aria-hidden size={14} />
      </IconButton>
    </NoticeCapsule>
  );
}
