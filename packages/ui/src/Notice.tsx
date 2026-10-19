import type { ReactNode } from "react";
import { Button } from "./Button.tsx";
import { cn } from "./cn.ts";

export type NoticeProps = {
  tone?: "info" | "success" | "warning" | "danger";
  title: ReactNode;
  text?: ReactNode;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  className?: string;
};
const colors = {
  info: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};
export function Notice({ tone = "info", title, text, action, className }: NoticeProps) {
  return (
    <div
      role={tone === "warning" || tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2",
        colors[tone],
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {text && <p className="text-muted">{text}</p>}
      </div>
      {action && (
        <Button type="button" onClick={action.onClick} disabled={action.disabled}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
