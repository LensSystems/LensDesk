import { useCallback } from "react";
import { cn } from "./cn.ts";

export type MarkdownViewProps = {
  html: string;
  className?: string;
  variant?: "default" | "reading";
  "aria-label"?: string;
};
// El HTML debe llegar generado y saneado por la herramienta.
export function MarkdownView({
  html,
  className,
  variant = "default",
  "aria-label": label,
}: MarkdownViewProps) {
  const mountHtml = useCallback(
    (element: HTMLElement | null) => {
      if (element) element.innerHTML = html;
    },
    [html],
  );
  return (
    <article
      aria-label={label}
      className={cn("ld-markdown-view", variant === "reading" && "ld-markdown-reading", className)}
      ref={mountHtml}
    />
  );
}
