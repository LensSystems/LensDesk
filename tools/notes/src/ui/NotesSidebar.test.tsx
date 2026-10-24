import { TooltipProvider } from "@lensdesk/ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { NotesSidebar } from "./NotesSidebar.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});

it("ofrece acciones plegadas y devuelve el foco al cerrar con Escape o elegir nota", async () => {
  const onSelect = vi.fn();
  const onCreate = vi.fn();
  const onImport = vi.fn();
  const onView = vi.fn();
  const { container } = render(
    <TooltipProvider>
      <NotesSidebar
        notes={[
          {
            id: "a",
            title: "Ejemplo",
            body_md: "",
            pinned: false,
            deleted_at: null,
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
          },
        ]}
        selectedId="a"
        trashed={false}
        query=""
        onQuery={vi.fn()}
        onSelect={onSelect}
        onCreate={onCreate}
        onImport={onImport}
        onView={onView}
        onEmpty={vi.fn()}
        onTrash={vi.fn()}
        onPin={vi.fn()}
      />
    </TooltipProvider>,
  );
  const rail = within(container.querySelector(".sidebar-rail") as HTMLElement);
  fireEvent.click(rail.getByRole("button", { name: "Nueva nota" }));
  fireEvent.click(rail.getByRole("button", { name: "Importar Markdown" }));
  expect(onCreate).toHaveBeenCalledOnce();
  expect(onImport).toHaveBeenCalledOnce();
  expect(rail.getAllByRole("button")).toHaveLength(3);
  for (const name of ["Notas", "Archivadas", "Papelera", "Buscar notas"]) {
    expect(rail.queryByRole("button", { name })).toBeNull();
  }
  const toggle = rail.getByRole("button", { name: "Mostrar lista de notas" });
  fireEvent.click(toggle);
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(toggle);
  fireEvent.click(toggle);
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", { name: "Ejemplo" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onSelect).toHaveBeenCalledWith("a");
  expect(document.activeElement).toBe(toggle);
  fireEvent.click(toggle);
  const reopened = await screen.findByRole("dialog", { name: "Notas" });
  expect(within(reopened).getByRole("radiogroup", { name: "Vista de notas" })).toBeTruthy();
  expect(within(reopened).queryByRole("button", { name: "Nueva nota" })).toBeNull();
  const close = within(reopened).getByRole("button", { name: "Cerrar" });
  expect(close).toHaveClass("size-8");
  expect(close.textContent).not.toContain("×");
  expect(close.querySelector("svg")).toHaveClass("lucide-x");
  expect(close.querySelector("svg")).toHaveAttribute("width", "16");
  fireEvent.click(close);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(toggle);
});
