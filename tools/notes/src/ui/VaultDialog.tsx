import { Dialog, DialogContent, DialogTitle } from "@lensdesk/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
export function VaultDialog({
  title,
  onClose,
  children,
  notice = false,
  titleIcon,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  notice?: boolean;
  titleIcon?: ReactNode;
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
        closeClassName="hidden"
        aria-describedby={undefined}
        className={`vault-dialog max-h-[90vh] overflow-auto ${notice ? "w-[512px] gap-4 p-6" : "w-[520px] gap-[14px] p-[22px]"}`}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.querySelector<HTMLElement>("[data-vault-trigger]")?.focus();
        }}
      >
        <div className="flex items-center gap-3">
          {titleIcon && (
            <span className="flex size-10 items-center justify-center rounded-ld-lg bg-accent-soft text-accent-soft-fg">
              {titleIcon}
            </span>
          )}
          <DialogTitle className="text-[18px] leading-[26.1px]">{title}</DialogTitle>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
