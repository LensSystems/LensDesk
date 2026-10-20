import type { ComponentProps } from "react";
import { cn } from "./cn.ts";
import { Tooltip } from "./Tooltip.tsx";

export type IconButtonProps = Omit<ComponentProps<"button">, "aria-label"> & {
  label: string;
  tooltipSide?: ComponentProps<typeof Tooltip>["side"];
};

export function IconButton({ className, label, tooltipSide, children, ...props }: IconButtonProps) {
  return (
    <Tooltip label={label} side={tooltipSide}>
      <button
        aria-label={label}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full border-0 bg-transparent text-muted transition-colors duration-150 ease-out hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
}
