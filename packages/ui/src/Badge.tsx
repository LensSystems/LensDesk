import type { HTMLAttributes } from "react";
import { cn } from "./cn.ts";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
};
const tones = {
  neutral: "bg-surface text-muted",
  accent: "bg-accent-soft text-accent-soft-fg",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-soft-fg",
  danger: "bg-danger-soft text-danger",
};
export function Badge({ className, tone = "warning", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    />
  );
}
