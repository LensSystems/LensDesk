import { type HTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "./cn.ts";

export type PanelProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title?: ReactNode;
  actions?: ReactNode;
};
export function Panel({ title, actions, children, className, ...props }: PanelProps) {
  const id = useId();
  return (
    <section
      {...props}
      aria-labelledby={props["aria-labelledby"] ?? (title ? id : undefined)}
      className={cn("rounded-ld-lg border border-border bg-surface text-text", className)}
    >
      {(title || actions) && (
        <header className="flex items-center gap-2 border-b border-border px-3 py-2">
          {title && (
            <h2 id={id} className="min-w-0 flex-1 font-semibold">
              {title}
            </h2>
          )}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
