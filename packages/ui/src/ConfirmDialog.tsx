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
  const cancelRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        aria-busy={busy}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          cancelRef.current?.querySelector("button")?.focus();
        }}
        onCloseAutoFocus={(event) => {
          if (!children && opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
      >
        <DialogTitle className="pr-6">{title}</DialogTitle>
        <DialogDescription className="text-muted">{description}</DialogDescription>
        <div ref={cancelRef} className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button size="lg" type="button">
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            size="lg"
            variant={tone === "danger" ? "danger" : "primary"}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
