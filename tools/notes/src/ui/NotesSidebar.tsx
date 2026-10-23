import {
  Dialog,
  DialogContent,
  DialogTitle,
  Download,
  IconButton,
  PanelLeft,
  Plus,
} from "@lensdesk/ui";
import { type ComponentProps, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NotesSidebarContent } from "./NotesSidebarContent.tsx";

export function NotesSidebar(props: ComponentProps<typeof NotesSidebarContent>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const wide = useRef<HTMLDivElement>(null);
  const show = (button: HTMLButtonElement) => {
    trigger.current = button;
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
          <PanelLeft size={16} aria-hidden="true" />
        </IconButton>
        <IconButton className="sidebar-create" label={t("newNote")} onClick={props.onCreate}>
          <Plus size={12} aria-hidden="true" />
        </IconButton>
        <IconButton label={t("import")} onClick={props.onImport}>
          <Download size={16} aria-hidden="true" />
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
              content?.querySelector<HTMLInputElement>("input:not(:disabled)") ??
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
          <DialogTitle className="sidebar-title">{t("notes")}</DialogTitle>
          <NotesSidebarContent
            {...props}
            showCreateActions={false}
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
