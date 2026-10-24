import { TooltipProvider } from "@lensdesk/ui";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { EditorView } from "codemirror";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { parseCredential } from "./credential-block.ts";
import { Editor } from "./Editor.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
function mount(privateNote: boolean, locked = false) {
  return render(
    <TooltipProvider>
      <Editor
        note={{
          id: "one",
          title: "Nota",
          body_md: "",
          private: privateNote,
          pinned: false,
          created_at: "now",
          updated_at: "now",
          deleted_at: null,
        }}
        locked={locked}
        preview={false}
        onMode={vi.fn()}
        onCopy={vi.fn(async () => true)}
        onCopyCode={vi.fn(async () => {})}
        onChange={vi.fn()}
        onBlur={vi.fn()}
        onExport={vi.fn()}
        onRename={vi.fn(async () => {})}
      />
    </TooltipProvider>,
  );
}
function openMenu() {
  fireEvent.contextMenu(screen.getByRole("textbox", { name: "Editar" }));
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Insertar" }), { key: "ArrowRight" });
  return screen.getByRole("menuitem", { name: "Contraseña…" });
}
it("deshabilita Contraseña en notas públicas", () => {
  mount(false);
  const item = openMenu();
  expect(item).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(item);
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("una nota privada bloqueada no expone el editor ni su menú Insertar", () => {
  mount(true, true);
  expect(screen.queryByRole("textbox", { name: "Editar" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Contraseña…" })).toBeNull();
  expect(screen.queryByRole("radio", { name: "Editar" })).toBeNull();
});
it("habilita Contraseña en privadas desbloqueadas, inserta y permite editar el bloque", async () => {
  mount(true);
  const view = EditorView.findFromDOM(screen.getByRole("textbox", { name: "Editar" }));
  if (!view) throw new Error("Editor ausente");
  const item = openMenu();
  expect(item).not.toHaveAttribute("aria-disabled", "true");
  fireEvent.click(item);
  fireEvent.change(await screen.findByLabelText("Usuario"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "clave" } });
  fireEvent.change(screen.getByLabelText("Notas"), { target: { value: "Acceso local" } });
  fireEvent.keyDown(screen.getByRole("button", { name: "Añadir campo" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Texto secreto" }));
  fireEvent.change(screen.getByLabelText("Nombre del campo"), { target: { value: "PIN" } });
  fireEvent.change(screen.getByLabelText("PIN"), { target: { value: "4321" } });
  fireEvent.click(screen.getByRole("button", { name: "Insertar" }));
  expect(view.state.doc.toString()).toContain("```credential");
  expect(parseCredential(view.state.doc.toString())).toEqual({
    user: "Ada",
    password: "clave",
    note: "Acceso local",
    fields: [{ title: "PIN", value: "4321", secret: true }],
  });
  expect(view.contentDOM.textContent).not.toContain("clave");
  act(() => view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf("user:") } }));
  fireEvent.click(openMenu());
  expect(await screen.findByLabelText("Usuario")).toHaveValue("Ada");
  fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "Grace" } });
  fireEvent.click(screen.getByRole("button", { name: "Insertar" }));
  expect(parseCredential(view.state.doc.toString()).user).toBe("Grace");
  expect(view.state.doc.toString().match(/```credential/g)).toHaveLength(1);
});
