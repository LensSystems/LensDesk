import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditorView } from "codemirror";
import i18n from "i18next";
import { useState } from "react";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import type { Note } from "./NoteList.tsx";
import { renderPreview } from "./preview.ts";
import { useAutosave } from "./use-autosave.ts";

const note = (id: string, body_md = "") => ({
  id,
  title: body_md.split("\n")[0]?.replace(/^# /, "") ?? "",
  body_md,
  pinned: false,
  created_at: "now",
  updated_at: "now",
  deleted_at: null,
});

function fakeClient() {
  let rows: Note[] = [];
  let contextListener: ((context: { locale: string; theme: string }) => void) | undefined;
  const files = [
    { token: "import", name: "one.md", size: 12 },
    { token: "import2", name: "two.md", size: 12 },
  ];
  const invoke = vi.fn(async (method: string, params?: unknown) => {
    const args = (params ?? {}) as {
      id?: string;
      body_md?: string;
      query?: string;
      trashed?: boolean;
      pinned?: boolean;
    };
    if (method === "list")
      return rows.filter((row) => Boolean(row.deleted_at) === (args.trashed === true));
    if (method === "search")
      return rows.filter(
        (row) =>
          !row.deleted_at && row.body_md.toLowerCase().includes(args.query?.toLowerCase() ?? ""),
      );
    if (method === "create") {
      const created = note(String(rows.length + 1), args.body_md);
      rows.push(created);
      return created;
    }
    if (method === "update") {
      const updated = note(args.id ?? "", args.body_md);
      rows = rows.map((row) => (row.id === args.id ? updated : row));
      return updated;
    }
    if (method === "trash" || method === "restore") {
      rows = rows.map((row) =>
        row.id === args.id ? { ...row, deleted_at: method === "trash" ? "now" : null } : row,
      );
      return rows.find((row) => row.id === args.id);
    }
    if (method === "setPinned") {
      rows = rows.map((row) =>
        row.id === args.id ? { ...row, pinned: args.pinned ?? false } : row,
      );
      return rows.find((row) => row.id === args.id);
    }
    if (method === "emptyTrash") {
      rows = rows.filter((row) => !row.deleted_at);
      return { deleted: true };
    }
    return null;
  });
  const client = {
    backend: { invoke },
    files: {
      pickOpen: vi.fn(async () => files),
      pickSave: vi.fn(async () => ({ token: "save", name: "note.md", size: 0 })),
      readText: vi.fn(async (token: string) => (token === "import" ? "# Uno" : "# Dos")),
      writeText: vi.fn(async () => undefined),
    },
    app: {
      getContext: vi.fn(async () => ({
        locale: "es",
        theme: "dark",
        hostVersion: "",
        toolVersion: "",
      })),
      onContextChange: vi.fn((listener: (context: { locale: string; theme: string }) => void) => {
        contextListener = listener;
        return () => {};
      }),
    },
  };
  return {
    client,
    invoke,
    files: client.files,
    changeLanguage: (locale: string) => contextListener?.({ locale, theme: "dark" }),
  };
}

// jsdom no implementa <dialog>.showModal(): este polyfill mínimo basta para las pruebas.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

beforeEach(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: "es",
    fallbackLng: "es",
    interpolation: { escapeValue: false },
  });
});

describe("interfaz de Notas", () => {
  it("guarda tras 800 ms reiniciados y al perder el foco", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    function Probe() {
      const [body, setBody] = useState("");
      const flush = useAutosave("n1", body, save);
      return (
        <>
          <input
            aria-label="contenido"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onBlur={flush}
          />
          <button type="button" onClick={() => window.dispatchEvent(new Event("beforeunload"))}>
            cerrar
          </button>
        </>
      );
    }
    render(<Probe />);
    fireEvent.change(screen.getByRole("textbox", { name: "contenido" }), {
      target: { value: "a" },
    });
    act(() => vi.advanceTimersByTime(700));
    fireEvent.change(screen.getByRole("textbox", { name: "contenido" }), {
      target: { value: "ab" },
    });
    act(() => vi.advanceTimersByTime(799));
    expect(save).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(save).toHaveBeenLastCalledWith("n1", "ab");
    fireEvent.blur(screen.getByRole("textbox", { name: "contenido" }));
    expect(save).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "cerrar" }));
    expect(save).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("sanea la vista previa y quita el origen remoto de imágenes", () => {
    const html = renderPreview(
      '<script>alert(1)</script><img src="https://example.invalid/x" onerror="alert(1)"><b onclick="x()">texto</b>',
    );
    const host = document.createElement("div");
    host.innerHTML = html;
    expect(host.querySelector("script")).toBeNull();
    expect(host.querySelector("img")?.hasAttribute("src")).toBe(false);
    expect(host.querySelector("img")?.hasAttribute("onerror")).toBe(false);
    expect(host.querySelector("b")?.hasAttribute("onclick")).toBe(false);
  });

  it("importa cada Markdown y exporta el cuerpo con el token elegido", async () => {
    const fake = fakeClient();
    render(<App client={fake.client as never} />);
    await screen.findAllByText("No hay notas. Crea una para empezar.");
    fireEvent.click(screen.getByRole("button", { name: "Importar Markdown" }));
    await screen.findByRole("button", { name: "Uno" });
    await screen.findByRole("button", { name: "Dos" });
    fireEvent.click(screen.getByRole("button", { name: "Dos" }));
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    await waitFor(() => expect(fake.files.writeText).toHaveBeenCalledWith("save", "# Dos"));
    expect(fake.files.pickOpen).toHaveBeenCalledWith(expect.objectContaining({ multiple: true }));
  });

  it("mueve una nota a Papelera y permite restaurarla", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Archivar" });
    render(<App client={fake.client as never} />);
    await screen.findByRole("button", { name: "Archivar" });
    fireEvent.click(screen.getByRole("button", { name: "Mover a la papelera" }));
    fireEvent.click(await screen.findByRole("button", { name: "Papelera" }));
    fireEvent.click(await screen.findByRole("button", { name: "Restaurar" }));
    await waitFor(() => expect(fake.invoke).toHaveBeenCalledWith("restore", { id: "1" }));
  });

  it("buscar no desmonta el cuadro de búsqueda ni pisa el texto sin guardar", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Borrador" });
    render(<App client={fake.client as never} />);
    const search = await screen.findByRole("textbox", { name: "Buscar notas" });
    await screen.findByRole("heading", { name: "Borrador" });
    const editor = document.querySelector(".cm-content") as HTMLElement;
    act(() => {
      const view = EditorView.findFromDOM(editor);
      view?.dispatch({ changes: { from: view.state.doc.length, insert: "\nsin guardar" } });
    });
    fireEvent.change(search, { target: { value: "B" } });
    await waitFor(() => expect(fake.invoke).toHaveBeenCalledWith("search", { query: "B" }));
    expect(screen.getByRole("textbox", { name: "Buscar notas" })).toBe(search);
    // Antes de que el autoguardado de 800 ms escriba nada, la recarga no debe pisar el editor.
    await act(async () => {});
    expect(fake.invoke).not.toHaveBeenCalledWith("update", expect.anything());
    expect(document.querySelector(".cm-content")?.textContent).toContain("sin guardar");
  });

  it("muestra el título localizado cuando la nota está vacía", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "" });
    render(<App client={fake.client as never} />);
    await screen.findByRole("heading", { name: "Sin título" });
    expect(es.untitled).toBe("Sin título");
    expect(en.untitled).toBe("Untitled");
  });

  it("vaciar la papelera pide confirmación en un diálogo propio con foco en Cancelar", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Vieja" });
    await fake.invoke("trash", { id: "1" });
    render(<App client={fake.client as never} />);
    fireEvent.click(await screen.findByRole("button", { name: "Papelera" }));
    fireEvent.click(await screen.findByRole("button", { name: "Vaciar papelera" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Vaciar la papelera?" });
    expect(dialog).toHaveTextContent("Esta acción no se puede deshacer.");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(fake.invoke).not.toHaveBeenCalledWith("emptyTrash");
    expect(dialog).not.toHaveAttribute("open");

    fireEvent.click(screen.getByRole("button", { name: "Vaciar papelera" }));
    const reopened = await screen.findByRole("dialog");
    fireEvent(reopened, new Event("cancel", { cancelable: true }));
    expect(reopened).not.toHaveAttribute("open");
    expect(fake.invoke).not.toHaveBeenCalledWith("emptyTrash");

    fireEvent.click(screen.getByRole("button", { name: "Vaciar papelera" }));
    const confirmButton = within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Vaciar papelera",
    });
    fireEvent.click(confirmButton);
    await waitFor(() => expect(fake.invoke).toHaveBeenCalledWith("emptyTrash"));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("ConfirmDialog solo se abre cuando open es true", () => {
    const props = {
      title: "T",
      message: "M",
      confirmLabel: "Sí",
      cancelLabel: "No",
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    };
    const { rerender } = render(<ConfirmDialog {...props} open={false} />);
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
    rerender(<ConfirmDialog {...props} open />);
    expect(document.querySelector("dialog")).toHaveAttribute("open");
  });

  it("avisa y recarga la lista cuando una acción responde E_NOT_FOUND", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Fantasma" });
    render(<App client={fake.client as never} />);
    await screen.findByRole("button", { name: "Fantasma" });
    const original = fake.invoke.getMockImplementation();
    fake.invoke.mockImplementation(async (method: string, params?: unknown) => {
      if (method === "trash") {
        await original?.("trash", params);
        throw Object.assign(new Error("Note not found"), { code: "E_NOT_FOUND" });
      }
      return original?.(method, params);
    });
    fake.invoke.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Mover a la papelera" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("La nota ya no existe. Se recargó la lista.");
    expect(within(alert).queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(within(alert).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    expect(fake.invoke).toHaveBeenCalledWith("list", { trashed: false });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Fantasma" })).toBeNull());
    expect(en.errors.notFound).toBe("The note no longer exists. The list was reloaded.");
  });

  it("no avisa de nota inexistente si la recarga también falla", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Uno" });
    render(<App client={fake.client as never} />);
    await screen.findByRole("button", { name: "Uno" });
    const original = fake.invoke.getMockImplementation();
    fake.invoke.mockImplementation(async (method: string, params?: unknown) => {
      if (method === "trash") throw Object.assign(new Error("x"), { code: "E_NOT_FOUND" });
      if (method === "list") throw Object.assign(new Error("x"), { code: "E_INTERNAL" });
      return original?.(method, params);
    });
    fireEvent.click(screen.getByRole("button", { name: "Mover a la papelera" }));
    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent("ya no existe");
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("conserva el texto como nota nueva si el autoguardado recibe E_NOT_FOUND", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Original" });
    render(<App client={fake.client as never} />);
    await screen.findByRole("heading", { name: "Original" });
    const original = fake.invoke.getMockImplementation();
    fake.invoke.mockImplementation(async (method: string, params?: unknown) => {
      if (method === "update") throw Object.assign(new Error("x"), { code: "E_NOT_FOUND" });
      return original?.(method, params);
    });
    const editor = document.querySelector(".cm-content") as HTMLElement;
    act(() => {
      const view = EditorView.findFromDOM(editor);
      view?.dispatch({ changes: { from: view.state.doc.length, insert: "\ntexto valioso" } });
    });
    fireEvent.blur(editor);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("La nota ya no existía; tu texto se guardó como nota nueva.");
    expect(within(alert).queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(fake.invoke).toHaveBeenCalledWith("create", { body_md: "# Original\ntexto valioso" });
    await waitFor(() =>
      expect(document.querySelector(".cm-content")?.textContent).toContain("texto valioso"),
    );
  });

  it("seleccionar una nota y esperar no llama a update", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Uno" });
    await fake.invoke("create", { body_md: "# Dos" });
    render(<App client={fake.client as never} />);
    await screen.findByRole("button", { name: "Dos" });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByRole("button", { name: "Dos" }));
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    vi.useRealTimers();
    expect(fake.invoke).not.toHaveBeenCalledWith("update", expect.anything());
  });
});
