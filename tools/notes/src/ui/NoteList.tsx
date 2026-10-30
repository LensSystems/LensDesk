import { Archive, ArchiveRestore, IconButton, ListItem, Lock, Star, Trash2 } from "@lensdesk/ui";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Highlighted } from "./Highlighted.tsx";
import { noteSummary } from "./note-summary.ts";

export type Note = {
  id: string;
  title: string;
  body_md: string;
  private?: boolean;
  orphaned?: boolean;
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
  vaultUnlocked = false,
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
  vaultUnlocked?: boolean;
  onArchive?: (note: Note) => void;
  onSelect: (id: string) => void;
  onTrash: (id: string) => void;
  onPin: (note: Note) => void;
}) {
  const { t } = useTranslation();
  const descriptionId = useId();
  return (
    <nav aria-label={t("notesList")} className="min-h-0 overflow-auto">
      {notes.map((note) => (
        <ListItem
          key={note.id}
          variant="card"
          containerClassName={`note-card rounded-ld-md ${selectedId === note.id ? "bg-accent-soft border-accent" : "bg-bg border-transparent"}`}
          className={note.private ? "private-note-card" : undefined}
          aria-label={note.title || t("untitled")}
          aria-describedby={
            note.private || note.orphaned ? `${descriptionId}-${note.id}` : undefined
          }
          title={
            <>
              {(note.private || note.orphaned) && (
                <Lock
                  size={15}
                  className={`note-card-lock ${selectedId === note.id ? "text-accent-soft-fg" : "text-muted"}`}
                  aria-hidden="true"
                />
              )}
              {query.trim() ? (
                <Highlighted text={note.title || t("untitled")} query={query} />
              ) : (
                note.title || t("untitled")
              )}
              {(note.private || note.orphaned) && (
                <span id={`${descriptionId}-${note.id}`} className="sr-only">
                  {t(
                    note.orphaned
                      ? "vault.listOrphanedDescription"
                      : vaultUnlocked
                        ? "vault.listUnlockedDescription"
                        : "vault.listLockedDescription",
                  )}
                </span>
              )}
            </>
          }
          secondaryText={
            note.orphaned ? (
              t("vault.orphaned")
            ) : note.private ? (
              vaultUnlocked ? null : (
                t("vault.listLocked")
              )
            ) : query.trim() ? (
              <Highlighted text={noteSummary(note.body_md, note.title, query)} query={query} />
            ) : (
              noteSummary(note.body_md, note.title)
            )
          }
          selected={selectedId === note.id}
          onClick={() => onSelect(note.id)}
          actions={
            !note.orphaned && !trashed && selectedId === note.id ? (
              <>
                {!archived && !note.archived_at && (
                  <IconButton
                    className={
                      note.pinned
                        ? "size-8 text-warning hover:text-warning"
                        : "size-8 hover:text-warning"
                    }
                    label={note.pinned ? t("unpin") : t("pin")}
                    onClick={() => onPin(note)}
                  >
                    <Star
                      size={15}
                      strokeWidth={2}
                      fill={note.pinned ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                  </IconButton>
                )}
                <IconButton
                  className="size-8 hover:text-accent"
                  label={t(note.archived_at ? "unarchive" : "archive")}
                  onClick={() => onArchive?.(note)}
                >
                  {note.archived_at ? (
                    <ArchiveRestore size={15} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Archive size={15} strokeWidth={2} aria-hidden="true" />
                  )}
                </IconButton>
                <IconButton
                  className="size-8 hover:text-danger"
                  label={t("moveToTrash")}
                  onClick={() => onTrash(note.id)}
                >
                  <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                </IconButton>
              </>
            ) : !note.orphaned && !trashed && !archived && !note.archived_at && note.pinned ? (
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
