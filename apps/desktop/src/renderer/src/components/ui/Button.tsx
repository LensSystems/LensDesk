import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn.ts";
import { Progress } from "./Progress.tsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  children: ReactNode;
};

export function Button({ className, disabled, loading = false, children, ...props }: ButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      className={cn(
        "inline-flex h-7 items-center justify-center gap-2 rounded border border-border-control bg-surface px-3 text-text hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Progress label={t("ui.loading")} />}
      {children}
    </button>
  );
}
