import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.ts";
import { Progress } from "./Progress.tsx";
import { useUiLabels } from "./ui-labels.ts";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "md" | "lg";
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
};

export function Button({
  className,
  disabled,
  variant = "default",
  size = "md",
  loading = false,
  loadingLabel,
  children,
  ...props
}: ButtonProps) {
  const labels = useUiLabels();
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none",
        size === "lg" ? "h-9 px-4 text-sm" : "h-8 px-3.5 text-[13px]",
        {
          default:
            "border border-border-control bg-surface-raised font-semibold text-text hover:bg-surface",
          primary: "border-0 bg-accent font-bold text-accent-fg hover:bg-accent-hover",
          danger: "border-0 bg-danger font-bold text-danger-fg hover:bg-danger/90",
          ghost: "border-0 bg-transparent font-semibold text-text hover:bg-surface",
        }[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Progress label={loadingLabel ?? labels.loading} />}
      {children}
    </button>
  );
}
