import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import { lockoutClient } from "./lockout-test-client.ts";
import { type Note, NoteList } from "./NoteList.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
it("la tarjeta huérfana tiene candado, aviso y ninguna acción de fijar ni archivar", () => {
  const row: Note = {
    id: "one",
    title: "Huérfana",
    body_md: "Secreto",
    orphaned: true,
    private: true,
    pinned: true,
    created_at: "now",
    updated_at: "now",
    deleted_at: "now",
  };
  render(
    <NoteList
      notes={[row]}
      selectedId="one"
      trashed
      vaultUnlocked
      onPin={vi.fn()}
      onSelect={vi.fn()}
      onTrash={vi.fn()}
      onArchive={vi.fn()}
    />,
  );
  const button = screen.getByRole("button", { name: "Huérfana" });
  expect(button).toHaveTextContent("No se puede abrir");
  expect(button).toHaveAccessibleDescription("Nota privada. No se puede abrir.");
  const lock = button.querySelector("svg");
  expect(lock).toHaveAttribute("width", "15");
  expect(lock).toHaveAttribute("aria-hidden", "true");
  expect(screen.queryByRole("button", { name: /Fijar|Desfijar|Archivar/ })).toBeNull();
  expect(screen.queryByText("Secreto")).toBeNull();
});
it("muestra el cuerpo huérfano y confirma antes de eliminar y recargar la lista", async () => {
  const f = lockoutClient(0, true);
  render(<App client={f.client as never} />);
  fireEvent.click(await screen.findByRole("radio", { name: "Papelera" }));
  expect(
    await screen.findByRole("heading", { name: "Esta nota no se puede abrir" }),
  ).toBeInTheDocument();
  expect(screen.getByText(es.vault.orphanedHelp)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Restaurar" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Eliminar para siempre" }));
  const dialog = await screen.findByRole("dialog", { name: "¿Eliminar para siempre?" });
  expect(dialog).toHaveTextContent(es.vault.deleteHelp);
  expect(f.invoke).not.toHaveBeenCalledWith("deleteForever", expect.anything());
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Eliminar para siempre" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar" }));
  await waitFor(() => expect(f.invoke).toHaveBeenCalledWith("deleteForever", { id: "one" }));
  await waitFor(() =>
    expect(screen.queryByRole("heading", { name: "Esta nota no se puede abrir" })).toBeNull(),
  );
  expect(f.invoke).not.toHaveBeenCalledWith("get", expect.anything());
  const methods = f.invoke.mock.calls.map(([method]) => method);
  expect(methods.slice(methods.indexOf("deleteForever") + 1)).toContain("list");
});
