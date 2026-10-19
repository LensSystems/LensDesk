import type { HTMLAttributes } from "react";
import { cn } from "./cn.ts";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex rounded border border-warning px-2 text-xs text-warning",
        className,
      )}
    />
  );
}
