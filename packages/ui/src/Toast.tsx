import { X } from "lucide-react";
import { Toast as Primitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn.ts";
import { useUiLabels } from "./ui-labels.ts";

export const ToastProvider = Primitive.Provider;

export function ToastViewport({ className, ...props }: ComponentProps<typeof Primitive.Viewport>) {
  return (
    <Primitive.Viewport {...props} className={cn("flex min-w-0 max-w-80 flex-col", className)} />
  );
}

export type ToastProps = Omit<ComponentProps<typeof Primitive.Root>, "children" | "title"> & {
  title: ReactNode;
  description?: ReactNode;
  dismissLabel?: string;
};

export function Toast({ className, title, description, dismissLabel, ...props }: ToastProps) {
  const labels = useUiLabels();
  return (
    <Primitive.Root
      {...props}
      className={cn(
        "ld-slide flex h-7 min-w-0 items-center gap-1 rounded-ld-md border border-border bg-surface-raised pl-2 text-xs shadow-ld text-text",
        className,
      )}
    >
      <Primitive.Title className="min-w-0 flex-1 truncate">{title}</Primitive.Title>
      {description && (
        <Primitive.Description className="sr-only">{description}</Primitive.Description>
      )}
      <Primitive.Close
        aria-label={dismissLabel ?? labels.dismiss}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface"
      >
        <X size={14} strokeWidth={2} className="text-muted" aria-hidden="true" />
      </Primitive.Close>
    </Primitive.Root>
  );
}
