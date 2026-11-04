import { X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";
import { IconButton } from "./IconButton.tsx";
import { TooltipProvider } from "./Tooltip.tsx";
import { useUiLabels } from "./ui-labels.ts";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export function DialogTitle({ className, ...props }: ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title {...props} className={cn("text-lg font-bold", className)} />;
}
export const DialogDescription = Primitive.Description;
export const DialogClose = Primitive.Close;

export type DialogContentProps = ComponentProps<typeof Primitive.Content> & {
  closeLabel?: string;
  closeClassName?: string;
};

export function DialogContent({
  className,
  children,
  closeLabel,
  closeClassName,
  onFocusCapture,
  ...props
}: DialogContentProps) {
  const labels = useUiLabels();
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="ld-fade fixed inset-0 z-40 bg-bg/60" />
      <Primitive.Content
        {...props}
        onFocusCapture={(event) => {
          onFocusCapture?.(event);
          if (event.defaultPrevented || !event.currentTarget.contains(event.target)) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const focused = event.target.getBoundingClientRect();
          // Radix evita el scroll al cerrar el ciclo de Tab; mantén alcanzable ese foco.
          if (focused.top < bounds.top || focused.bottom > bounds.bottom) {
            event.target.scrollIntoView({ block: "nearest", inline: "nearest" });
          }
        }}
        className={cn(
          "ld-pop fixed left-1/2 top-1/2 z-50 grid w-[420px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-auto scroll-p-1 gap-4 -translate-x-1/2 -translate-y-1/2 rounded-ld-xl border border-border bg-surface-raised p-6 text-text shadow-ld",
          className,
        )}
      >
        {children}
        <TooltipProvider>
          <Primitive.Close asChild>
            <IconButton
              tooltip={false}
              label={closeLabel ?? labels.close}
              className={cn("absolute right-2 top-2", closeClassName)}
            >
              <X size={16} strokeWidth={2} className="text-muted" aria-hidden="true" />
            </IconButton>
          </Primitive.Close>
        </TooltipProvider>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
