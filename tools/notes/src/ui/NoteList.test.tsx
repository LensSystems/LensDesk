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
  const { rerender } = render(
    <TooltipProvider>
      <NoteList
        notes={[
          base,
          { ...base, id: "b", title: "Guardada", archived_at: "2025-01-02T00:00:00.000Z" },
        ]}
        selectedId="a"
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
  rerender(
    <TooltipProvider>
      <NoteList
        notes={[{ ...base, id: "b", title: "Guardada", archived_at: "2025-01-02T00:00:00.000Z" }]}
        selectedId="b"
        trashed={false}
        onArchive={onArchive}
        onSelect={vi.fn()}
        onTrash={vi.fn()}
        onPin={vi.fn()}
      />
    </TooltipProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Desarchivar nota" }));
  expect(onArchive).toHaveBeenLastCalledWith(expect.objectContaining({ id: "b" }));
});

it("solo muestra acciones en la seleccionada y mueve su estrella al seleccionarla", () => {
  const props = {
    notes: [
      { ...base, pinned: true },
      { ...base, id: "b", title: "Otra" },
    ],
    selectedId: "b",
    trashed: false,
    onSelect: vi.fn(),
    onTrash: vi.fn(),
    onPin: vi.fn(),
  };
  const { rerender } = render(<NoteList {...props} />, { wrapper: TooltipProvider });
  expect(screen.getAllByRole("button", { name: "Fijar nota" })).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Archivar nota" })).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Mover a la papelera" })).toHaveLength(1);
  expect(screen.getByRole("img", { name: "Fijada" })).toHaveClass("note-pin", "text-warning");
  expect(screen.queryByRole("button", { name: "Desfijar nota" })).toBeNull();
  rerender(<NoteList {...props} selectedId="a" />);
  expect(screen.queryByRole("img", { name: "Fijada" })).toBeNull();
  const pin = screen.getByRole("button", { name: "Desfijar nota" });
  expect(pin).toHaveClass("text-warning");
  expect(pin.querySelector("svg")).toHaveAttribute("fill", "currentColor");
  expect(screen.queryByRole("button", { name: "Fijar nota" })).toBeNull();
  rerender(<NoteList {...props} selectedId={null} />);
  expect(screen.queryByRole("button", { name: "Archivar nota" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Mover a la papelera" })).toBeNull();
});
