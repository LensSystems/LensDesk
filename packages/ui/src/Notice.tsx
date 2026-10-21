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
  info: "bg-accent-soft text-accent-soft-fg",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-soft-fg",
  danger: "bg-danger-soft text-danger",
};
export function Notice({ tone = "info", title, text, action, className }: NoticeProps) {
  return (
    <div
      role={tone === "warning" || tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-3 rounded-ld-md px-3.5 py-2 text-[13px]",
        colors[tone],
        className,
      )}
    >
      {/* El texto del aviso se puede copiar: suele llevar el detalle de un error. */}
      <div className="ld-selectable min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {text && <p>{text}</p>}
      </div>
      {action && (
        <Button type="button" onClick={action.onClick} disabled={action.disabled}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
