import { Toast as Primitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn.ts";

export const ToastProvider = Primitive.Provider;

export function ToastViewport({ className, ...props }: ComponentProps<typeof Primitive.Viewport>) {
  return (
    <Primitive.Viewport
      {...props}
      className={cn("flex min-w-0 max-w-80 flex-col outline-none", className)}
    />
  );
}

type ToastProps = Omit<ComponentProps<typeof Primitive.Root>, "children"> & {
  title: ReactNode;
  description?: ReactNode;
};

export function Toast({ className, title, description, ...props }: ToastProps) {
  const { t } = useTranslation();
  return (
    <Primitive.Root
      {...props}
      className={cn(
        "ld-slide flex h-7 min-w-0 items-center gap-1 rounded border border-border bg-surface-raised pl-2 text-xs text-text outline-none",
        className,
      )}
    >
      <Primitive.Title className="min-w-0 flex-1 truncate">{title}</Primitive.Title>
      {description && (
        <Primitive.Description className="sr-only">{description}</Primitive.Description>
      )}
      <Primitive.Close
        aria-label={t("ui.dismiss")}
        className="size-6 shrink-0 rounded text-muted hover:bg-surface"
      >
        ×
      </Primitive.Close>
    </Primitive.Root>
  );
}
