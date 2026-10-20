import { TooltipProvider } from "@lensdesk/ui";
import { tags } from "@lezer/highlight";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditorView } from "codemirror";
import i18n from "i18next";
import { useState } from "react";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import { markdownHighlightStyle } from "./markdown-highlight.ts";
import { type Note, NoteList } from "./NoteList.tsx";
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
  let contextListener:
    | ((context: { locale: string; theme: string; accent?: "blue" | "green" }) => void)
    | undefined;
  const files = [
    { token: "import", name: "one.md", size: 12 },
    { token: "import2", name: "two.md", size: 12 },
  ];
  const invoke = vi.fn(async (method: string, params?: unknown) => {
    // Como el backend real: todo método exige un objeto de parámetros, aunque esté vacío.
    if (typeof params !== "object" || params === null)
      throw Object.assign(new Error("Expected an object"), { code: "E_INVALID_PARAMS" });
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
      onContextChange: vi.fn(
        (
          listener: (context: { locale: string; theme: string; accent?: "blue" | "green" }) => void,
        ) => {
          contextListener = listener;
          return () => {};
        },
      ),
    },
  };
  return {
    client,
    invoke,
    files: client.files,
    changeAccent: (accent?: "blue" | "green") =>
      contextListener?.({ locale: "es", theme: "dark", ...(accent ? { accent } : {}) }),
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
  it("actualiza el acento en vivo y acepta contexto sin acento", async () => {
    const fake = fakeClient();
    render(<App client={fake.client as never} />);
    await waitFor(() => expect(fake.client.app.onContextChange).toHaveBeenCalled());
    await act(async () => fake.changeAccent("green"));
    expect(document.documentElement.dataset.accent).toBe("green");
    await act(async () => fake.changeAccent());
    expect(document.documentElement.hasAttribute("data-accent")).toBe(false);
  });

  it("conserva y guarda el texto al cambiar de nota antes del debounce", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# A" });
    await fake.invoke("create", { body_md: "# B" });
    render(<App client={fake.client as never} />);
    await screen.findByRole("heading", { name: "A" });
    act(() => {
      const view = EditorView.findFromDOM(document.querySelector(".cm-content") as HTMLElement);
      view?.dispatch({ changes: { from: view.state.doc.length, insert: "\nTexto pendiente" } });
    });
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    expect(document.querySelector(".cm-content")).toHaveTextContent("Texto pendiente");
    await waitFor(() =>
      expect(fake.invoke).toHaveBeenCalledWith("update", {
        id: "1",
        body_md: "# A\nTexto pendiente",
      }),
    );
  });

  it("alterna vista previa y editor conservando contenido", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Documento\n**Contenido**" });
    render(<App client={fake.client as never} />);
    await screen.findByRole("heading", { name: "Documento" });
    const editor = document.querySelector(".cm-content");
    fireEvent.click(screen.getByRole("radio", { name: "Vista previa" }));
    expect(screen.getByRole("article").querySelector("strong")).toHaveTextContent("Contenido");
    fireEvent.click(screen.getByRole("radio", { name: "Editar" }));
    expect(screen.queryByRole("article")).toBeNull();
    expect(document.querySelector(".cm-content")).toBe(editor);
    expect(editor).toHaveTextContent("**Contenido**");
  });

  it("muestra resumen y acciones hermanas dentro de la tarjeta", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Tarjeta\n- **Resumen**" });
    render(<App client={fake.client as never} />);
    const main = await screen.findByRole("button", { name: "Tarjeta" });
    const card = main.parentElement as HTMLElement;
    expect(within(card).getByText("Resumen")).toBeInTheDocument();
    for (const name of ["Fijar nota", "Mover a la papelera"]) {
      const action = within(card).getByRole("button", { name });
      expect(main.contains(action)).toBe(false);
      expect(action.parentElement?.closest("button")).toBeNull();
    }
  });

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
    fireEvent.click(await screen.findByRole("radio", { name: "Papelera" }));
    fireEvent.click(await screen.findByRole("button", { name: "Archivar" }));
    expect(screen.getByRole("article")).toHaveTextContent("Archivar");
    expect(document.querySelector(".cm-content")).toBeNull();
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

  it("vaciar la papelera pide confirmación en un diálogo con foco en Cancelar", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Vieja" });
    await fake.invoke("trash", { id: "1" });
    render(<App client={fake.client as never} />);
    fireEvent.click(await screen.findByRole("radio", { name: "Papelera" }));
    fireEvent.click(await screen.findByRole("button", { name: "Vaciar papelera" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Vaciar la papelera?" });
    expect(dialog).toHaveTextContent("Esta acción no se puede deshacer.");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(fake.invoke).not.toHaveBeenCalledWith("emptyTrash", expect.anything());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Vaciar papelera" }));
    const reopened = await screen.findByRole("dialog");
    fireEvent.keyDown(reopened, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fake.invoke).not.toHaveBeenCalledWith("emptyTrash", expect.anything());

    fireEvent.click(screen.getByRole("button", { name: "Vaciar papelera" }));
    const confirmButton = within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Vaciar papelera",
    });
    fireEvent.click(confirmButton);
    await waitFor(() => expect(fake.invoke).toHaveBeenCalledWith("emptyTrash", {}));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Restaurar" })).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("usa los componentes compartidos y cancela el vaciado con Escape", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Vista" });
    render(<App client={fake.client as never} />);
    await screen.findByRole("heading", { name: "Vista" });
    const group = screen.getByRole("radiogroup", { name: "Vista de notas" });
    const notes = within(group).getByRole("radio", { name: "Notas" });
    const trash = within(group).getByRole("radio", { name: "Papelera" });
    notes.focus();
    fireEvent.keyDown(notes, { key: "ArrowRight" });
    await waitFor(() => expect(trash).toHaveFocus());
    expect(trash).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(trash, { key: "ArrowLeft" });
    await waitFor(() => expect(notes).toHaveFocus());
    expect(notes).toHaveAttribute("aria-checked", "true");
    fireEvent.click(await screen.findByRole("radio", { name: "Vista previa" }));
    expect(screen.getByRole("article")).toHaveClass("ld-markdown-view");
    fireEvent.click(screen.getByRole("button", { name: "Mover a la papelera" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Vista" })).toBeNull());
    fireEvent.click(trash);
    fireEvent.click(await screen.findByRole("button", { name: "Vaciar papelera" }));
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fake.invoke).not.toHaveBeenCalledWith("emptyTrash", expect.anything());
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

  it("al cambiar de nota con un guardado en curso, el texto se recupera una sola vez", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Uno" });
    await fake.invoke("create", { body_md: "# Dos" });
    render(<App client={fake.client as never} />);
    const selected = await screen.findByRole("heading", { level: 2 });
    const other = selected.textContent === "Uno" ? "Dos" : "Uno";
    const original = fake.invoke.getMockImplementation();
    fake.invoke.mockImplementation(async (method: string, params?: unknown) => {
      if (method === "update") {
        await new Promise((resolve) => setTimeout(resolve, 20));
        throw Object.assign(new Error("x"), { code: "E_NOT_FOUND" });
      }
      return original?.(method, params);
    });
    const editor = document.querySelector(".cm-content") as HTMLElement;
    act(() => {
      const view = EditorView.findFromDOM(editor);
      view?.dispatch({ changes: { from: view.state.doc.length, insert: "\ntexto único" } });
    });
    fireEvent.blur(editor);
    fireEvent.click(screen.getByRole("button", { name: other }));
    await screen.findByRole("alert");
    const copies = fake.invoke.mock.calls.filter(
      ([method, params]) =>
        method === "create" &&
        String((params as { body_md?: string }).body_md).includes("texto único"),
    );
    expect(copies).toHaveLength(1);
  });

  it("el editor colorea los títulos de Markdown", async () => {
    const fake = fakeClient();
    await fake.invoke("create", { body_md: "# Coloreado" });
    render(<App client={fake.client as never} />);
    await screen.findByRole("heading", { name: "Coloreado" });
    const heading = markdownHighlightStyle.style([tags.heading]) ?? "sin-clase";
    await waitFor(() => {
      const span = [...document.querySelectorAll(".cm-line span")].find((node) =>
        node.textContent?.includes("Coloreado"),
      );
      expect(span?.className).toContain(heading);
    });
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

describe("resaltado en la lista", () => {
  it("resalta título y primera línea coincidente, y conserva el nombre accesible", () => {
    const props = {
      notes: [note("1", "Ideas Sprint\nResumen habitual\n- **Sprint** pendiente")],
      selectedId: null,
      trashed: false,
      onSelect: vi.fn(),
      onTrash: vi.fn(),
      onPin: vi.fn(),
    };
    const { container, rerender } = render(<NoteList {...props} query="spr" />, {
      wrapper: TooltipProvider,
    });
    const button = screen.getByRole("button", { name: "Ideas Sprint" });
    // La primera línea del cuerpo también puede contener el título.
    expect([...button.querySelectorAll("mark")].map((mark) => mark.textContent)).toEqual([
      "Sprint",
      "Sprint",
    ]);
    rerender(
      <NoteList
        {...props}
        notes={[
          { ...note("1", "Ideas Sprint"), body_md: "Resumen habitual\n- **Sprint** pendiente" },
        ]}
        query="spr"
      />,
    );
    expect(button.textContent).toContain("Sprint pendiente");
    expect(button.textContent).not.toContain("Resumen habitual");
    rerender(<NoteList {...props} query="" />);
    expect(container.querySelector("mark")).toBeNull();
    expect(button.textContent).toContain("Resumen habitual");
  });

  it("mantiene el resumen habitual si solo coincide el título", () => {
    render(
      <NoteList
        notes={[{ ...note("1", "Resumen habitual"), title: "Sprint" }]}
        selectedId={null}
        trashed={false}
        query="spr"
        onSelect={vi.fn()}
        onTrash={vi.fn()}
        onPin={vi.fn()}
      />,
      { wrapper: TooltipProvider },
    );
    const button = screen.getByRole("button", { name: "Sprint" });
    expect(button.textContent).toContain("Resumen habitual");
    expect(button.querySelectorAll("mark")).toHaveLength(1);
  });

  it("pinta etiquetas como texto seguro", () => {
    const title = "<img src=x onerror=alert(1)>";
    const { container } = render(
      <NoteList
        notes={[note("1", title)]}
        selectedId={null}
        trashed={false}
        query="img"
        onSelect={vi.fn()}
        onTrash={vi.fn()}
        onPin={vi.fn()}
      />,
      { wrapper: TooltipProvider },
    );
    const button = screen.getByRole("button", { name: title });
    expect(button.textContent).toContain(title);
    expect(button.querySelector("mark")?.textContent).toBe("img");
    expect(container.querySelector("img")).toBeNull();
  });
});
