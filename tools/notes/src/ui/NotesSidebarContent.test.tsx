import { TooltipProvider } from "@lensdesk/ui";
import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { NotesSidebarContent } from "./NotesSidebarContent.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});

it("ordena buscador, selector y acciones sin cabecera, y expande el botón de crear", () => {
  render(
    <NotesSidebarContent
      notes={[]}
      selectedId={null}
      trashed={false}
      query=""
      onQuery={vi.fn()}
      onCreate={vi.fn()}
      onImport={vi.fn()}
      onEmpty={vi.fn()}
      onView={vi.fn()}
      onSelect={vi.fn()}
      onTrash={vi.fn()}
      onPin={vi.fn()}
    />,
    { wrapper: TooltipProvider },
  );
  const search = screen.getByRole("textbox", { name: "Buscar notas" });
  const selector = screen.getByRole("radiogroup", { name: "Vista de notas" });
  const create = screen.getByRole("button", { name: "Nueva nota" });
  const importButton = screen.getByRole("button", { name: es.import });
  expect(search.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(selector.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(
    create.compareDocumentPosition(importButton) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(create).toHaveClass("flex-1");
  expect(screen.queryByRole("heading", { name: "Notas" })).toBeNull();
  expect(selector).toHaveClass("w-full");
});

it("muestra las acciones solo donde sirven: crear en Notas y vaciar con notas en la papelera", () => {
  const props = {
    selectedId: null,
    query: "",
    onQuery: vi.fn(),
    onCreate: vi.fn(),
    onImport: vi.fn(),
    onEmpty: vi.fn(),
    onView: vi.fn(),
    onSelect: vi.fn(),
    onTrash: vi.fn(),
    onPin: vi.fn(),
  };
  const note = {
    id: "n1",
    title: "Borrada",
    body_md: "",
    pinned: false,
    created_at: "",
    updated_at: "",
    deleted_at: "2026-01-01T00:00:00Z",
  };
  const view = render(<NotesSidebarContent {...props} notes={[]} trashed archived={false} />, {
    wrapper: TooltipProvider,
  });
  expect(screen.queryByRole("button", { name: es.emptyTrash })).toBeNull();
  expect(screen.queryByRole("button", { name: "Nueva nota" })).toBeNull();
  expect(screen.getByText(es.emptyTrashTitle)).toBeTruthy();
  view.rerender(<NotesSidebarContent {...props} notes={[note]} trashed archived={false} />);
  expect(screen.getByRole("button", { name: es.emptyTrash })).toBeTruthy();
  expect(screen.queryByRole("button", { name: es.import })).toBeNull();
  view.rerender(<NotesSidebarContent {...props} notes={[]} trashed={false} archived />);
  expect(screen.queryByRole("button", { name: "Nueva nota" })).toBeNull();
  expect(screen.queryByRole("button", { name: es.emptyTrash })).toBeNull();
});
