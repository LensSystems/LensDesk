import { Tooltip as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";
import { useTooltipMotion } from "./tooltip-motion.ts";

export function TooltipContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  const { content, onPlaced } = useTooltipMotion();
  return (
    <Primitive.Content
      {...props}
      ref={content}
      {...{ onPlaced }}
      className={cn(
        "ld-tooltip z-50 rounded-ld-md border border-border bg-surface-raised px-2 py-1 text-xs text-text shadow-ld",
        className,
      )}
      sideOffset={4}
    />
  );
}
