import type { HTMLAttributes } from "react";
import { cn } from "./cn.ts";

export type ToolbarProps = HTMLAttributes<HTMLDivElement> & { "aria-label": string };
export function Toolbar({ className, ...props }: ToolbarProps) {
  return (
    <div
      {...props}
      role="toolbar"
      className={cn("flex items-center gap-2 border-b border-border px-3 py-2", className)}
    />
  );
}
