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
      <label className="sr-only" htmlFor="note-search">
        {t("search")}
      </label>
      <input
        id="note-search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={t("search")}
      />
      {!trashed && (
        <button type="button" onClick={onCreate}>
          {t("newNote")}
        </button>
      )}
      <nav aria-label={t("notesList")}>
        {notes.map((note) => (
          <div className={`note-row${selectedId === note.id ? " selected" : ""}`} key={note.id}>
            <button className="note-title" type="button" onClick={() => onSelect(note.id)}>
              {note.title || t("untitled")}
            </button>
            {!trashed && (
              <button
                type="button"
                aria-label={note.pinned ? t("unpin") : t("pin")}
                onClick={() => onPin(note)}
              >
                {note.pinned ? "★" : "☆"}
              </button>
            )}
            {!trashed && (
              <button type="button" aria-label={t("moveToTrash")} onClick={() => onTrash(note.id)}>
                ×
              </button>
            )}
          </div>
        ))}
        {notes.length === 0 && <p className="muted">{t("emptyNotes")}</p>}
      </nav>
    </aside>
  );
}
