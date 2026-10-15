import { Dialog as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn.ts";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export const DialogClose = Primitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  const { t } = useTranslation();
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-40 bg-bg/60" />
      <Primitive.Content
        {...props}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-surface-raised p-4 text-text shadow-[0_8px_24px_rgb(0_0_0/0.24)]",
          className,
        )}
      >
        {children}
        <Primitive.Close
          aria-label={t("ui.close")}
          className="absolute right-2 top-2 rounded px-2 py-1 text-muted hover:bg-surface"
        >
          ×
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
