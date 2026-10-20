import type { ReactNode } from "react";

export type EmptyStateProps = { title: string; description?: string; action?: ReactNode };

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="grid justify-items-center gap-4 rounded-ld-lg p-6 text-center">
      <h2 className="text-lg font-bold text-text">{title}</h2>
      {description && <p className="text-muted">{description}</p>}
      {action}
    </section>
  );
}
