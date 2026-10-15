import type { ReactNode } from "react";

type EmptyStateProps = { title: string; description?: string; action?: ReactNode };

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="grid justify-items-center gap-2 p-6 text-center">
      <h2 className="text-[15px] font-medium text-text">{title}</h2>
      {description && <p className="text-muted">{description}</p>}
      {action}
    </section>
  );
}
