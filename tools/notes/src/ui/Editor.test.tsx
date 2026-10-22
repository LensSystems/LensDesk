import { TooltipProvider } from "@lensdesk/ui";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { EditorView } from "codemirror";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { Editor } from "./Editor.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});

it("actualiza botones de historial y empieza vacío al montar otra nota", () => {
  const props = {
    preview: false,
    onMode: vi.fn(),
    onCopy: vi.fn(async () => true),
    onCopyCode: vi.fn(async () => {}),
    onChange: vi.fn(),
    onBlur: vi.fn(),
    onExport: vi.fn(),
    onRename: vi.fn(async () => {}),
  };
  const note = {
    id: "1",
    title: "",
    body_md: "Inicial",
    pinned: false,
    created_at: "now",
    updated_at: "now",
    deleted_at: null,
  };
  const { rerender } = render(
    <TooltipProvider>
      <Editor key="1" {...props} note={note} />
    </TooltipProvider>,
  );
  const undo = screen.getByRole("button", { name: "Deshacer" });
  const redo = screen.getByRole("button", { name: "Rehacer" });
  expect(undo).toBeDisabled();
  expect(redo).toBeDisabled();
  const view = EditorView.findFromDOM(screen.getByRole("textbox", { name: "Editar" }));
  if (!view) throw new Error("Editor ausente");
  act(() => view.dispatch({ changes: { from: 7, insert: " nuevo" } }));
  expect(undo).toBeEnabled();
  fireEvent.click(undo);
  expect(view.state.doc.toString()).toBe("Inicial");
  expect(undo).toBeDisabled();
  expect(redo).toBeEnabled();
  fireEvent.click(redo);
  expect(view.state.doc.toString()).toBe("Inicial nuevo");
  expect(redo).toBeDisabled();
  fireEvent.keyDown(view.contentDOM, { key: "z", code: "KeyZ", ctrlKey: true });
  expect(view.state.doc.toString()).toBe("Inicial");
  fireEvent.keyDown(view.contentDOM, {
    key: "Z",
    code: "KeyZ",
    keyCode: 90,
    ctrlKey: true,
    shiftKey: true,
  });
  expect(view.state.doc.toString()).toBe("Inicial nuevo");
  fireEvent.keyDown(view.contentDOM, { key: "z", code: "KeyZ", ctrlKey: true });
  fireEvent.keyDown(view.contentDOM, { key: "y", code: "KeyY", ctrlKey: true });
  expect(view.state.doc.toString()).toBe("Inicial nuevo");
  act(() => view.dispatch({ selection: { anchor: 0, head: 7 } }));
  fireEvent.keyDown(view.contentDOM, { key: "b", code: "KeyB", ctrlKey: true });
  expect(view.state.doc.toString()).toBe("**Inicial** nuevo");
  fireEvent.keyDown(view.contentDOM, { key: "b", code: "KeyB", ctrlKey: true });
  expect(view.state.doc.toString()).toBe("Inicial nuevo");
  rerender(
    <TooltipProvider>
      <Editor key="2" {...props} note={{ ...note, id: "2", body_md: "Otra" }} />
    </TooltipProvider>,
  );
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Rehacer" })).toBeDisabled();
});
