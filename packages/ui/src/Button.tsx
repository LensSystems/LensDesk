import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.ts";
import { Progress } from "./Progress.tsx";
import { useUiLabels } from "./ui-labels.ts";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
};

export function Button({
  className,
  disabled,
  loading = false,
  loadingLabel,
  children,
  ...props
}: ButtonProps) {
  const labels = useUiLabels();
  return (
    <button
      className={cn(
        "inline-flex h-7 items-center justify-center gap-2 rounded border border-border-control bg-surface px-3 text-text hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60",
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
