import { Button, EmptyState, StickyNote } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";

export function EmptyNote({
  trashed,
  archived = false,
  query = "",
  onCreate,
}: {
  trashed: boolean;
  archived?: boolean;
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
            : archived
              ? t("emptyArchivedTitle")
              : query.trim()
                ? t("noResults", { query })
                : t("emptyNotes")
        }
        description={
          trashed
            ? t("emptyTrashDescription")
            : archived
              ? t("emptyArchivedDescription")
              : undefined
        }
        action={
          !trashed &&
          !archived && (
            <Button variant="primary" onClick={onCreate}>
              {t("newNote")}
            </Button>
          )
        }
      />
    </section>
  );
}
