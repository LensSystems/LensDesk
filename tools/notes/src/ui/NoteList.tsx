import { Archive, ArchiveRestore, IconButton, ListItem, Lock, Star, Trash2 } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { Highlighted } from "./Highlighted.tsx";
import { noteSummary } from "./note-summary.ts";

export type Note = {
  id: string;
  title: string;
  body_md: string;
  private?: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  archived_at?: string | null;
};

export type NotesView = "notes" | "archived" | "trash";

export function NoteList({
  notes,
  query = "",
  selectedId,
  trashed,
  archived = false,
  onArchive,
  onSelect,
  onTrash,
  onPin,
}: {
  notes: Note[];
  query?: string;
  selectedId: string | null;
  trashed: boolean;
  archived?: boolean;
  onArchive?: (note: Note) => void;
  onSelect: (id: string) => void;
  onTrash: (id: string) => void;
  onPin: (note: Note) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("notesList")} className="min-h-0 overflow-auto">
      {notes.map((note) => (
        <ListItem
          key={note.id}
          variant="card"
          containerClassName="note-card"
          aria-label={note.title || t("untitled")}
          title={
            query.trim() ? (
              <Highlighted text={note.title || t("untitled")} query={query} />
            ) : (
              note.title || t("untitled")
            )
          }
          secondaryText={
            note.private ? (
              <Lock size={14} aria-label={t("vault.private")} />
            ) : query.trim() ? (
              <Highlighted text={noteSummary(note.body_md, note.title, query)} query={query} />
            ) : (
              noteSummary(note.body_md, note.title)
            )
          }
          selected={selectedId === note.id}
          onClick={() => onSelect(note.id)}
          actions={
            !trashed && selectedId === note.id ? (
              <>
                <IconButton
                  className={
                    note.pinned
                      ? "size-7 text-warning hover:text-warning"
                      : "size-7 hover:text-warning"
                  }
                  label={note.pinned ? t("unpin") : t("pin")}
                  onClick={() => onPin(note)}
                >
                  <Star size={14} fill={note.pinned ? "currentColor" : "none"} aria-hidden="true" />
                </IconButton>
                <IconButton
                  className="size-7 hover:text-accent"
                  label={t(note.archived_at ? "unarchive" : "archive")}
                  onClick={() => onArchive?.(note)}
                >
                  {note.archived_at ? (
                    <ArchiveRestore size={14} aria-hidden="true" />
                  ) : (
                    <Archive size={14} aria-hidden="true" />
                  )}
                </IconButton>
                <IconButton
                  className="size-7 hover:text-danger"
                  label={t("moveToTrash")}
                  onClick={() => onTrash(note.id)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </IconButton>
              </>
            ) : !trashed && note.pinned ? (
              <Star
                className="note-pin text-warning"
                size={14}
                fill="currentColor"
                aria-label={t("pinned")}
                role="img"
              />
            ) : null
          }
        />
      ))}
      {notes.length === 0 &&
        (trashed ? (
          <div className="trash-empty">
            <span className="trash-empty-icon">
              <Trash2 size={18} aria-hidden="true" />
            </span>
            <p className="font-bold text-text">{t("emptyTrashTitle")}</p>
            <p className="text-muted">{t("emptyTrashDescription")}</p>
          </div>
        ) : (
          <div className="text-muted">
            <p>
              {archived
                ? t("emptyArchivedTitle")
                : query.trim()
                  ? t("noResults", { query })
                  : t("emptyNotes")}
            </p>
            {archived && <p>{t("emptyArchivedDescription")}</p>}
          </div>
        ))}
    </nav>
  );
}
