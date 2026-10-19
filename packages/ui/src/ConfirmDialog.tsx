import { type ReactNode, useRef } from "react";
import { Button } from "./Button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./Dialog.tsx";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  tone?: "default" | "danger";
  busy?: boolean;
  children?: ReactNode;
};
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  tone = "default",
  busy = false,
  children,
}: ConfirmDialogProps) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        closeLabel={cancelLabel}
        aria-busy={busy}
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (!children && opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
      >
        <DialogTitle className="mb-2 text-[15px] font-semibold">{title}</DialogTitle>
        <DialogDescription className="mb-4 text-muted">{description}</DialogDescription>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button">{cancelLabel}</Button>
          </DialogClose>
          <Button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={
              tone === "danger"
                ? "border-danger bg-danger text-accent-fg hover:bg-danger"
                : undefined
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
