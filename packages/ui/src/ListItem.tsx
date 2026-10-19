import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.ts";

export type ListItemProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "children"> & {
  title: ReactNode;
  secondaryText?: ReactNode;
  actions?: ReactNode;
  selected?: boolean;
};
export function ListItem({
  title,
  secondaryText,
  actions,
  selected = false,
  className,
  ...props
}: ListItemProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        {...props}
        type="button"
        aria-current={selected ? "true" : undefined}
        className={cn(
          "min-h-7 min-w-0 flex-1 rounded border border-border-control bg-surface px-2 text-left text-text transition-colors duration-150 ease-out hover:bg-surface-raised disabled:opacity-60 motion-reduce:transition-none",
          selected && "border-accent",
          className,
        )}
      >
        <span className="block truncate">{title}</span>{" "}
        {secondaryText && (
          <span className="block truncate text-xs text-muted">{secondaryText}</span>
        )}
      </button>
      {actions}
    </div>
  );
}
