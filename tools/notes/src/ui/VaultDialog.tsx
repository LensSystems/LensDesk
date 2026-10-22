import { Dialog, DialogContent, DialogTitle } from "@lensdesk/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function VaultDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        aria-describedby={undefined}
        className="max-h-[90vh] overflow-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.querySelector<HTMLButtonElement>("[data-vault-trigger]")?.focus();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
