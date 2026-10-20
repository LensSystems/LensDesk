import type { ComponentProps } from "react";
import { HEADER_HEIGHT } from "../../../shared/layout.ts";

export function PageFrame({ children, ...props }: ComponentProps<"main">) {
  return (
    <main
      {...props}
      style={{ height: `calc(100dvh - ${HEADER_HEIGHT}px - 12px)` }}
      className="mx-3 mb-3 flex min-h-0 flex-col gap-7 overflow-y-auto rounded-ld-lg border border-border bg-surface-raised px-12 py-10"
    >
      {children}
    </main>
  );
}
