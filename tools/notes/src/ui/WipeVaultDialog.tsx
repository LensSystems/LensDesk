import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Trash2,
} from "@lensdesk/ui";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
export function WipeVaultDialog({
  privateCount,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  privateCount: number;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, i18n } = useTranslation();
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        closeClassName="hidden"
        aria-busy={busy}
        onCloseAutoFocus={(event) => {
          if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
            event.preventDefault();
            return;
          }
          const target = returnFocus.current?.isConnected
            ? returnFocus.current
            : document.querySelector<HTMLElement>("[data-vault-trigger]");
          if (!target) return;
          event.preventDefault();
          target.focus();
        }}
      >
        <DialogTitle>{t("vault.wipeTitle")}</DialogTitle>
        <DialogDescription className="text-[13px] leading-[18.85px] text-muted">
          {t("vault.wipeHelp")}
        </DialogDescription>
        <div className="flex gap-2 text-[13px] leading-[18.85px] text-warning-soft-fg">
          <Trash2 size={16} className="shrink-0 text-warning" aria-hidden="true" />
          <p>
            {privateCount === 0
              ? t("vault.wipeEmpty")
              : t(privateCount === 1 ? "vault.wipeCount_one" : "vault.wipeCount_other", {
                  replace: { count: new Intl.NumberFormat(i18n.language).format(privateCount) },
                })}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <footer className="flex justify-end gap-2">
          <Button size="lg" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button size="lg" variant="danger" loading={busy} onClick={onConfirm}>
            {t("vault.wipe")}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
