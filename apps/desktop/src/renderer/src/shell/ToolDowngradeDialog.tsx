import {
  ArrowDown,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@lensdesk/ui";
import { Trans, useTranslation } from "react-i18next";
import type { PendingDowngrade } from "../../../shared/host-channels.ts";

export function ToolDowngradeDialog({
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: PendingDowngrade | null;
  onConfirm: (target: PendingDowngrade) => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex items-center gap-3 pr-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-ld-md bg-warning-soft text-warning-soft-fg">
            <ArrowDown aria-hidden size={20} />
          </div>
          <DialogTitle>{t("toolsPage.downgradeTitle")}</DialogTitle>
        </div>
        <DialogDescription className="text-muted">
          {pending && (
            <Trans
              i18nKey="toolsPage.downgradeDescription"
              values={{ installed: pending.installedVersion, incoming: pending.version }}
              components={{ version: <strong className="font-mono font-bold text-text" /> }}
            />
          )}
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <Button size="lg" onClick={() => onOpenChange(false)}>
            {t("toolsPage.cancel")}
          </Button>
          <Button size="lg" variant="primary" onClick={() => pending && void onConfirm(pending)}>
            {t("toolsPage.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
