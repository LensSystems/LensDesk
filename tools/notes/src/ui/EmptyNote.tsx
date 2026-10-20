import { Button, EmptyState, StickyNote } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";

export function EmptyNote({ trashed, onCreate }: { trashed: boolean; onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="editor-panel empty-state">
      <StickyNote size={32} aria-hidden="true" className="text-muted" />
      <EmptyState
        title={t("emptyNotes")}
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
