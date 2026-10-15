import { Toast as Primitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn.ts";

export const ToastProvider = Primitive.Provider;

export function ToastViewport({ className, ...props }: ComponentProps<typeof Primitive.Viewport>) {
  return (
    <Primitive.Viewport
      {...props}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none",
        className,
      )}
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
        "relative rounded-md border border-border bg-surface-raised p-3 pr-10 text-text shadow-[0_8px_24px_rgb(0_0_0/0.24)] outline-none",
        className,
      )}
    >
      <Primitive.Title className="font-medium">{title}</Primitive.Title>
      {description && (
        <Primitive.Description className="mt-1 text-xs text-muted">
          {description}
        </Primitive.Description>
      )}
      <Primitive.Close
        aria-label={t("ui.dismiss")}
        className="absolute right-2 top-2 rounded px-2 py-1 text-muted hover:bg-surface"
      >
        ×
      </Primitive.Close>
    </Primitive.Root>
  );
}
