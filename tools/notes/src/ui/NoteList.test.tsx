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
  expect(pin).toHaveClass("text-warning", "size-8");
  expect(screen.getByRole("button", { name: "Activa" }).parentElement).toHaveClass(
    "bg-accent-soft",
    "border-accent",
    "rounded-ld-md",
  );
  expect(pin.querySelector("svg")).toHaveAttribute("fill", "currentColor");
  expect(screen.queryByRole("button", { name: "Fijar nota" })).toBeNull();
  rerender(<NoteList {...props} selectedId={null} />);
  expect(screen.queryByRole("button", { name: "Archivar nota" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Mover a la papelera" })).toBeNull();
});

it("oculta las estrellas en Archivadas incluso para notas fijadas", () => {
  const props = {
    notes: [{ ...base, pinned: true, archived_at: "2025-01-02" }],
    selectedId: "a",
    trashed: false,
    archived: true,
    onSelect: vi.fn(),
    onTrash: vi.fn(),
    onPin: vi.fn(),
  };
  const { rerender } = render(<NoteList {...props} />, { wrapper: TooltipProvider });
  expect(screen.queryByRole("button", { name: "Desfijar nota" })).toBeNull();
  expect(screen.getByRole("button", { name: "Desarchivar nota" })).toBeTruthy();
  rerender(<NoteList {...props} selectedId={null} />);
  expect(screen.queryByRole("img", { name: "Fijada" })).toBeNull();
});

it("muestra Bloqueada y mantiene el candado sin revelar contenido al desbloquear", () => {
  const props = {
    notes: [{ ...base, private: true, body_md: "No revelar" }],
    selectedId: "a",
    trashed: false,
    onSelect: vi.fn(),
    onTrash: vi.fn(),
    onPin: vi.fn(),
  };
  const { rerender } = render(<NoteList {...props} />, { wrapper: TooltipProvider });
  expect(screen.getByRole("button", { name: "Activa" })).toHaveTextContent("Bloqueada");
  expect(screen.getByRole("button", { name: "Activa" }).querySelector("svg")).toHaveClass(
    "note-card-lock",
    "text-accent-soft-fg",
  );
  rerender(<NoteList {...props} vaultUnlocked />);
  expect(screen.queryByText("Bloqueada")).toBeNull();
  expect(screen.queryByText("No revelar")).toBeNull();
  expect(screen.getByRole("button", { name: "Activa" }).querySelector("svg")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

it("describe privacidad y bloqueo sin cambiar el título accesible ni revelar el cuerpo", () => {
  render(
    <NoteList
      notes={[{ ...base, private: true, body_md: "secreto-sintetico" }]}
      selectedId="a"
      trashed={false}
      onSelect={vi.fn()}
      onTrash={vi.fn()}
      onPin={vi.fn()}
    />,
    { wrapper: TooltipProvider },
  );
  const note = screen.getByRole("button", { name: "Activa" });
  expect(note).toHaveAccessibleDescription("Nota privada. Bloqueada.");
  expect(note).toHaveAttribute("aria-current", "true");
  expect(note).not.toHaveAccessibleDescription(/secreto-sintetico/);
});

it("distingue privada desbloqueada, huérfana y pública sin descripciones duplicadas", () => {
  const props = {
    notes: [{ ...base, private: true, body_md: "secreto-sintetico" }],
    selectedId: null,
    trashed: false,
    onSelect: vi.fn(),
    onTrash: vi.fn(),
    onPin: vi.fn(),
  };
  const { rerender } = render(<NoteList {...props} vaultUnlocked />, { wrapper: TooltipProvider });
  expect(screen.getByRole("button", { name: "Activa" })).toHaveAccessibleDescription(
    "Nota privada. Desbloqueada.",
  );
  rerender(<NoteList {...props} notes={[{ ...base, orphaned: true }]} vaultUnlocked />);
  expect(screen.getByRole("button", { name: "Activa" })).toHaveAccessibleDescription(
    "Nota privada. No se puede abrir.",
  );
  rerender(<NoteList {...props} notes={[base]} />);
  expect(screen.getByRole("button", { name: "Activa" })).not.toHaveAttribute("aria-describedby");
});
