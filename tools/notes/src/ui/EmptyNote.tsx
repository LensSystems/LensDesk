import { Button, EmptyState, StickyNote } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";

export function EmptyNote({
  trashed,
  query = "",
  onCreate,
}: {
  trashed: boolean;
  query?: string;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="editor-panel empty-state">
      <StickyNote size={32} aria-hidden="true" className="text-muted" />
      <EmptyState
        title={
          trashed
            ? t("emptyTrashTitle")
            : query.trim()
              ? t("noResults", { query })
              : t("emptyNotes")
        }
        description={trashed ? t("emptyTrashDescription") : undefined}
        action={
          !trashed && (
            <Button variant="primary" onClick={onCreate}>
              {t("newNote")}
            </Button>
          )
        }
      />
    </section>
  );
}
