import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.ts";

export type ListItemProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "children"> & {
  title: ReactNode;
  footer?: ReactNode;
  containerClassName?: string;
  secondaryText?: ReactNode;
  actions?: ReactNode;
  selected?: boolean;
  variant?: "row" | "card";
};
export function ListItem({
  title,
  footer,
  containerClassName,
  secondaryText,
  actions,
  selected = false,
  variant = "row",
  className,
  ...props
}: ListItemProps) {
  if (variant === "card")
    return (
      <div
        className={cn(
          "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] rounded-ld-lg border bg-surface-raised px-3.5 py-3",
          selected ? "border-accent" : "border-border",
          containerClassName,
        )}
      >
        <button
          {...props}
          type="button"
          aria-label={props["aria-label"] ?? (typeof title === "string" ? title : undefined)}
          aria-current={selected ? "true" : undefined}
          className={cn("col-start-1 row-start-1 min-w-0 text-left text-text", className)}
        >
          <span className="block truncate font-bold leading-7">{title}</span>
          {secondaryText && (
            <span className="block truncate text-[13px] text-muted">{secondaryText}</span>
          )}
        </button>
        {footer && <div className="col-span-2 min-w-0 pt-2">{footer}</div>}
        {actions && (
          <div className="col-start-2 row-start-1 flex shrink-0 items-start gap-1 pl-1">
            {actions}
          </div>
        )}
      </div>
    );
  return (
    <div className="flex min-w-0 items-center gap-1">
      <button
        {...props}
        type="button"
        aria-current={selected ? "true" : undefined}
        className={cn(
          "min-h-7 min-w-0 flex-1 rounded-ld-lg border border-border bg-surface-raised px-3.5 py-3 text-left text-text transition-colors duration-150 ease-out hover:bg-surface disabled:opacity-60 motion-reduce:transition-none",
          selected && "border-accent",
          className,
        )}
      >
        <span className="block truncate">{title}</span>{" "}
        {secondaryText && (
          <span className="block truncate text-xs text-muted">{secondaryText}</span>
        )}
      </button>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
