import { Button, IconButton, Input, Plus, Search, SegmentedControl, Upload } from "@lensdesk/ui";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { NoteList } from "./NoteList.tsx";

export function NotesSidebar({
  query,
  onQuery,
  onCreate,
  onImport,
  onEmpty,
  onView,
  ...list
}: ComponentProps<typeof NoteList> & {
  query: string;
  onQuery: (query: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onEmpty: () => void;
  onView: (trash: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <aside className="note-list">
      <div className="sidebar-heading">
        <h1>{t("title")}</h1>
        <IconButton label={t("import")} onClick={onImport}>
          <Upload size={16} aria-hidden="true" />
        </IconButton>
        {list.trashed ? (
          <Button variant="danger" onClick={onEmpty}>
            {t("emptyTrash")}
          </Button>
        ) : (
          <Button variant="primary" onClick={onCreate}>
            <Plus size={15} aria-hidden="true" />
            {t("newNote")}
          </Button>
        )}
      </div>
      <Input
        label={<span className="sr-only">{t("search")}</span>}
        id="note-search"
        leadingIcon={<Search size={15} />}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={t("search")}
      />
      <SegmentedControl
        aria-label={t("notesView")}
        value={list.trashed ? "trash" : "notes"}
        onValueChange={(value) => onView(value === "trash")}
        options={[
          { value: "notes", label: t("notes") },
          { value: "trash", label: t("trash") },
        ]}
      />
      <NoteList {...list} />
    </aside>
  );
}
