import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

export function ActionsCard({ children }: { children: ReactNode }) {
  const headingId = useId();
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-ld-lg border border-border bg-surface-raised"
    >
      <h2
        id={headingId}
        className="px-4 pt-3 text-xs font-bold uppercase tracking-wider text-muted"
      >
        {t("actionsHeading")}
      </h2>
      <div>{children}</div>
    </section>
  );
}
