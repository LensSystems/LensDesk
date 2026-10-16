import type { ComponentProps } from "react";
import { cn } from "../cn.ts";
import { Tooltip } from "./Tooltip.tsx";

type IconButtonProps = Omit<ComponentProps<"button">, "aria-label"> & {
  label: string;
  tooltipSide?: ComponentProps<typeof Tooltip>["side"];
};

export function IconButton({ className, label, tooltipSide, children, ...props }: IconButtonProps) {
  return (
    <Tooltip label={label} side={tooltipSide}>
      <button
        aria-label={label}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded text-text hover:bg-surface-raised",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
}
