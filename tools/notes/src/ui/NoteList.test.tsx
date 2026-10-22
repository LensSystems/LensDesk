import { TooltipProvider } from "@lensdesk/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { NoteList } from "./NoteList.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});

const base = {
  id: "a",
  title: "Activa",
  body_md: "",
  pinned: false,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  deleted_at: null,
};

it("el botón de archivar sigue el estado de la nota, no la vista que se está cargando", () => {
  const onArchive = vi.fn();
  render(
    <TooltipProvider>
      <NoteList
        notes={[
          base,
          { ...base, id: "b", title: "Guardada", archived_at: "2025-01-02T00:00:00.000Z" },
        ]}
        selectedId={null}
        trashed={false}
        archived
        onArchive={onArchive}
        onSelect={vi.fn()}
        onTrash={vi.fn()}
        onPin={vi.fn()}
      />
    </TooltipProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Archivar nota" }));
  expect(onArchive).toHaveBeenLastCalledWith(base);
  fireEvent.click(screen.getByRole("button", { name: "Desarchivar nota" }));
  expect(onArchive).toHaveBeenLastCalledWith(expect.objectContaining({ id: "b" }));
});
