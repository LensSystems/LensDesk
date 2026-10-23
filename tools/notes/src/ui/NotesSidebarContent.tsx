import { Button, Download, IconButton, Input, Plus, Search, SegmentedControl } from "@lensdesk/ui";
import { type ComponentProps, useId } from "react";
import { useTranslation } from "react-i18next";
import { NoteList, type NotesView } from "./NoteList.tsx";

export function NotesSidebarContent({
  query,
  onQuery,
  onCreate,
  onImport,
  onEmpty,
  onView,
  showCreateActions = true,
  ...list
}: ComponentProps<typeof NoteList> & {
  showCreateActions?: boolean;
  query: string;
  onQuery: (query: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onEmpty: () => void;
  onView: (view: NotesView) => void;
}) {
  const { t } = useTranslation();
  const searchId = useId();
  return (
    <div className="note-list">
      <Input
        label={<span className="sr-only">{t("search")}</span>}
        id={searchId}
        leadingIcon={<Search size={15} />}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={t("search")}
        disabled={list.trashed || list.archived}
      />
      <SegmentedControl
        fullWidth
        aria-label={t("notesView")}
        value={list.trashed ? "trash" : list.archived ? "archived" : "notes"}
        onValueChange={(value) => onView(value as NotesView)}
        options={[
          { value: "notes", label: t("notes") },
          { value: "archived", label: t("archived") },
          { value: "trash", label: t("trash") },
        ]}
      />
      {list.trashed
        ? list.notes.length > 0 && (
            <Button variant="danger" onClick={onEmpty}>
              {t("emptyTrash")}
            </Button>
          )
        : showCreateActions &&
          !list.archived && (
            <div className="sidebar-heading">
              <Button className="flex-1" variant="primary" onClick={onCreate}>
                <Plus size={15} aria-hidden="true" />
                {t("newNote")}
              </Button>
              <IconButton
                className="border border-border-control"
                label={t("import")}
                onClick={onImport}
              >
                <Download size={16} aria-hidden="true" />
              </IconButton>
            </div>
          )}
      <NoteList {...list} query={list.trashed || list.archived ? "" : query} />
    </div>
  );
}
