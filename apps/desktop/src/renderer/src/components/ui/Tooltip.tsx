import { Tooltip as Primitive } from "radix-ui";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "../cn.ts";

export function TooltipProvider(props: ComponentProps<typeof Primitive.Provider>) {
  return <Primitive.Provider delayDuration={300} skipDelayDuration={200} {...props} />;
}

type TooltipProps = {
  label: string;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
  side?: ComponentProps<typeof Primitive.Content>["side"];
};

// Requiere un TooltipProvider en el árbol (se monta una vez en App.tsx).
export function Tooltip({ label, children, className, side = "bottom" }: TooltipProps) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          className={cn(
            "ld-pop z-50 rounded border border-border bg-surface-raised px-2 py-1 text-xs text-text shadow-[0_8px_24px_rgb(0_0_0/0.24)]",
            className,
          )}
          side={side}
          sideOffset={4}
        >
          {label}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
