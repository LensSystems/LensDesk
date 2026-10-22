import {
  Archive,
  Dialog,
  DialogContent,
  DialogTitle,
  Download,
  IconButton,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from "@lensdesk/ui";
import { type ComponentProps, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NotesSidebarContent } from "./NotesSidebarContent.tsx";

export function NotesSidebar(props: ComponentProps<typeof NotesSidebarContent>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const search = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const wide = useRef<HTMLDivElement>(null);
  const show = (button: HTMLButtonElement, searching = false) => {
    trigger.current = button;
    search.current = searching;
    setOpen(true);
  };
  return (
    <aside className="notes-sidebar">
      <div className="sidebar-wide" ref={wide}>
        <NotesSidebarContent {...props} />
      </div>
      <fieldset className="sidebar-rail" aria-label={t("notesView")}>
        <IconButton
          label={t("showNotes")}
          aria-expanded={open}
          onClick={(event) => show(event.currentTarget)}
        >
          <StickyNote size={16} />
        </IconButton>
        <IconButton label={t("newNote")} onClick={props.onCreate}>
          <Plus size={16} />
        </IconButton>
        <IconButton
          label={t("search")}
          onClick={(event) => {
            props.onView("notes");
            show(event.currentTarget, true);
          }}
        >
          <Search size={16} />
        </IconButton>
        {(
          [
            ["notes", StickyNote],
            ["archived", Archive],
            ["trash", Trash2],
          ] as const
        ).map(([view, Icon]) => (
          <IconButton
            key={view}
            label={t(view)}
            aria-pressed={
              view === (props.trashed ? "trash" : props.archived ? "archived" : "notes")
            }
            onClick={(event) => {
              props.onView(view);
              show(event.currentTarget);
            }}
          >
            <Icon size={16} />
          </IconButton>
        ))}
        <IconButton label={t("import")} onClick={props.onImport}>
          <Download size={16} />
        </IconButton>
      </fieldset>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          ref={panel}
          // Las clases sustituyen el centrado del diálogo base (tailwind-merge).
          className="sidebar-overlay translate-x-0 translate-y-0"
          closeLabel={t("close")}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const content = panel.current;
            (
              content?.querySelector<HTMLInputElement>(search.current ? "input" : "nav button") ??
              content?.querySelector<HTMLButtonElement>("button")
            )?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // Si la ventana se ensanchó con el panel abierto, la barra ya no se ve: el foco va a
            // la lista amplia (nota seleccionada o búsqueda).
            const rail = trigger.current?.closest(".sidebar-rail");
            if (rail && getComputedStyle(rail).display !== "none") trigger.current?.focus();
            else
              ["nav [aria-current='true']", "input:not(:disabled)", "button:not(:disabled)"]
                .map((selector) => wide.current?.querySelector<HTMLElement>(selector))
                .find(Boolean)
                ?.focus();
          }}
        >
          <DialogTitle className="sr-only">{t("notesList")}</DialogTitle>
          <NotesSidebarContent
            {...props}
            onSelect={(id) => {
              props.onSelect(id);
              setOpen(false);
            }}
            onCreate={() => {
              props.onCreate();
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </aside>
  );
}
