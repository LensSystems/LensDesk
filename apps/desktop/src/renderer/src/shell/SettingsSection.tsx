import { type ReactNode, useId } from "react";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-ld-lg border border-border bg-surface">
      <h2
        id={headingId}
        className="px-4 pt-3 text-xs font-bold tracking-wider uppercase text-muted"
      >
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}
