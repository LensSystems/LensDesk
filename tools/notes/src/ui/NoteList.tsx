import { Button, IconButton, Input, ListItem } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";

export type Note = {
  id: string;
  title: string;
  body_md: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function NoteList({
  notes,
  selectedId,
  query,
  trashed,
  onQuery,
  onSelect,
  onCreate,
  onTrash,
  onPin,
}: {
  notes: Note[];
  selectedId: string | null;
  query: string;
  trashed: boolean;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onTrash: (id: string) => void;
  onPin: (note: Note) => void;
}) {
  const { t } = useTranslation();
  return (
    <aside className="note-list">
      <Input
        label={<span className="sr-only">{t("search")}</span>}
        id="note-search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={t("search")}
      />
      {!trashed && (
        <Button type="button" onClick={onCreate}>
          {t("newNote")}
        </Button>
      )}
      <nav aria-label={t("notesList")}>
        {notes.map((note) => (
          <ListItem
            key={note.id}
            title={note.title || t("untitled")}
            selected={selectedId === note.id}
            onClick={() => onSelect(note.id)}
            actions={
              !trashed && (
                <>
                  <IconButton
                    type="button"
                    label={note.pinned ? t("unpin") : t("pin")}
                    onClick={() => onPin(note)}
                  >
                    {note.pinned ? "★" : "☆"}
                  </IconButton>
                  <IconButton
                    type="button"
                    label={t("moveToTrash")}
                    onClick={() => onTrash(note.id)}
                  >
                    ×
                  </IconButton>
                </>
              )
            }
          />
        ))}
        {notes.length === 0 && <p className="muted">{t("emptyNotes")}</p>}
      </nav>
    </aside>
  );
}
