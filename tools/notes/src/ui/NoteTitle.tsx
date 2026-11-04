import { IconButton, Pencil } from "@lensdesk/ui";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export function NoteTitle({
  title,
  onRename,
}: {
  title: string;
  onRename: (title: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(!title);
  const [draft, setDraft] = useState(title);
  const active = useRef(!title);
  const focusInput = useCallback((input: HTMLInputElement | null) => {
    input?.focus();
  }, []);
  // Mientras se guarda, el campo no admite cambios que luego se perderían al cerrarse.
  const [saving, setSaving] = useState(false);
  const begin = () => {
    // Con un borrador abierto o guardándose, el lápiz no lo reemplaza por el título anterior.
    if (editing || saving) return;
    setDraft(title);
    active.current = true;
    setEditing(true);
  };
  const save = () => {
    if (!active.current) return;
    active.current = false;
    if (draft === title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    void onRename(draft)
      .then(() => setEditing(false))
      .catch(() => {
        active.current = true;
      })
      .finally(() => setSaving(false));
  };
  return (
    <div className="note-title flex min-w-0 flex-1 items-center gap-1">
      {editing ? (
        <input
          ref={focusInput}
          aria-label={t("noteTitle")}
          className="h-7 min-w-0 w-full px-2 rounded-ld-sm border border-border-control bg-surface text-text"
          value={draft}
          readOnly={saving}
          maxLength={200}
          placeholder={t("untitled")}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              active.current = false;
              setEditing(false);
            }
          }}
        />
      ) : (
        // biome-ignore lint/a11y/useKeyWithClickEvents: con teclado se edita con el botón lápiz.
        <h2
          className="min-w-0 cursor-text truncate text-[18px] leading-7 font-bold text-text"
          onClick={begin}
        >
          {title || t("untitled")}
        </h2>
      )}
      <IconButton className="shrink-0" label={t("editTitle")} onClick={begin}>
        <Pencil size={14} aria-hidden="true" />
      </IconButton>
    </div>
  );
}
