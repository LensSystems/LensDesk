import { type FileHandle, type InvokeOptions, LensError } from "@lensdesk/sdk";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import { renderMarkdown } from "./Preview.tsx";

const handle = (name: string): FileHandle => ({ token: `tok-${name}`, name, size: 10 });
const TABLE = "| Nombre | Valor |\n| --- | --- |\n| Ada | 1 |";

function fakeClient(picked: FileHandle[]) {
  let dropListener: ((files: FileHandle[]) => void) | undefined;
  let saves = 0;
  const invoke = vi.fn(async (_method: string, params: unknown, options: InvokeOptions = {}) => {
    const { name } = params as { token: string; name: string };
    if (name.startsWith("lento")) {
      options.onProgress?.({ fraction: 0.5, message: "Página 1 de 2" });
      // Como el cliente real: abortar la señal rechaza con E_CANCELLED.
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener("abort", () =>
          reject(new LensError("E_CANCELLED", "Request cancelled")),
        );
      });
    }
    if (name.endsWith(".txt"))
      // Los códigos propios de la herramienta llegan como un LensError con otro `code`.
      throw Object.assign(new LensError("E_INTERNAL", "Formato de archivo no compatible"), {
        code: "E_UNSUPPORTED_FORMAT",
      });
    return { markdown: `# ${name}\n\n${TABLE}`, warnings: name.includes("img") ? ["x"] : [] };
  });
  const client = {
    backend: { invoke },
    files: {
      pickOpen: vi.fn(async () => picked),
      pickSave: vi.fn(async () => {
        saves += 1;
        return { token: `save-${saves}`, name: "out.md", size: 0 };
      }),
      writeText: vi.fn(async () => undefined),
      onDrop: vi.fn((listener: (files: FileHandle[]) => void) => {
        dropListener = listener;
        return () => {};
      }),
    },
    ui: { copyText: vi.fn(async () => undefined) },
    app: {
      getContext: vi.fn(async () => ({
        locale: "es",
        theme: "dark",
        hostVersion: "",
        toolVersion: "",
      })),
      onContextChange: vi.fn(() => () => {}),
    },
  };
  return { client, invoke, drop: (files: FileHandle[]) => act(() => dropListener?.(files)) };
}

const row = (name: string) => screen.getByRole("button", { name }).closest("li") as HTMLElement;

beforeEach(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: "es",
    fallbackLng: "es",
    interpolation: { escapeValue: false },
  });
});

describe("interfaz del Convertidor", () => {
  it("convierte en orden, muestra el progreso y cancela solo la fila elegida", async () => {
    const fake = fakeClient([handle("lento.pdf"), handle("datos.csv")]);
    render(<App client={fake.client as never} />);
    fireEvent.click(screen.getByRole("button", { name: "Elegir archivos…" }));

    const progress = await screen.findByRole("progressbar", { name: "Progreso de lento.pdf" });
    await waitFor(() => expect(progress).toHaveAttribute("value", "0.5"));
    expect(within(row("lento.pdf")).getByText("Convirtiendo…")).toBeInTheDocument();
    expect(within(row("lento.pdf")).getByText(/50\s?%/)).toBeInTheDocument();
    // La conversión es secuencial: el segundo espera en cola.
    expect(within(row("datos.csv")).getByText("En cola")).toBeInTheDocument();
    expect(fake.invoke).toHaveBeenCalledTimes(1);
    expect(fake.client.files.pickOpen).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: true }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar conversión de lento.pdf" }));
    await waitFor(() =>
      expect(within(row("lento.pdf")).getByText("Conversión cancelada.")).toBeInTheDocument(),
    );
    await waitFor(() => expect(within(row("datos.csv")).getByText("Listo")).toBeInTheDocument());
    expect(fake.invoke).toHaveBeenLastCalledWith(
      "convert",
      { token: "tok-datos.csv", name: "datos.csv", locale: "es" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      screen.queryByRole("button", { name: "Cancelar conversión de datos.csv" }),
    ).not.toBeInTheDocument();
  });

  it("envía el idioma actual al backend al convertir", async () => {
    await i18n.changeLanguage("en");
    const fake = fakeClient([handle("datos.csv")]);
    fake.client.app.getContext.mockResolvedValue({
      locale: "en",
      theme: "dark",
      hostVersion: "",
      toolVersion: "",
    });
    render(<App client={fake.client as never} />);
    fireEvent.click(await screen.findByRole("button", { name: "Choose files…" }));
    await waitFor(() =>
      expect(fake.invoke).toHaveBeenCalledWith(
        "convert",
        { token: "tok-datos.csv", name: "datos.csv", locale: "en" },
        expect.anything(),
      ),
    );
  });

  it("marca un fallo con el mensaje localizado y sigue con la cola", async () => {
    const fake = fakeClient([handle("notas.txt"), handle("pagina-img.html")]);
    render(<App client={fake.client as never} />);
    fireEvent.click(screen.getByRole("button", { name: "Elegir archivos…" }));
    await waitFor(() =>
      expect(
        within(row("notas.txt")).getByText("Formato de archivo no compatible."),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(within(row("pagina-img.html")).getByText("Listo")).toBeInTheDocument(),
    );
    expect(
      within(row("pagina-img.html")).getByText(
        "El documento original tenía imágenes que se omitieron.",
      ),
    ).toBeInTheDocument();
    expect(fake.invoke).toHaveBeenCalledTimes(2);
  });

  it("muestra la vista renderizada y la cruda, copia y guarda cada resultado", async () => {
    const fake = fakeClient([handle("a.html")]);
    render(<App client={fake.client as never} />);
    fake.drop([handle("a.html"), handle("b.csv")]);
    await waitFor(() => expect(within(row("b.csv")).getByText("Listo")).toBeInTheDocument());

    expect(screen.getByRole("tab", { name: "Vista renderizada" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const rendered = screen.getByRole("tabpanel", { name: "Vista renderizada" });
    expect(within(rendered).getByRole("table")).toBeInTheDocument();
    expect(within(rendered).getByRole("heading", { name: "a.html" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Markdown crudo" }));
    const raw = screen.getByRole("tabpanel", { name: "Markdown crudo" });
    expect(raw.textContent).toContain(TABLE);

    fireEvent.click(screen.getByRole("button", { name: "b.csv" }));
    expect(screen.getByRole("tabpanel", { name: "Markdown crudo" }).textContent).toContain(
      "# b.csv",
    );

    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() =>
      expect(fake.client.ui.copyText).toHaveBeenCalledWith(`# b.csv\n\n${TABLE}`),
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar .md" }));
    await waitFor(() =>
      expect(fake.client.files.writeText).toHaveBeenCalledWith("save-1", `# b.csv\n\n${TABLE}`),
    );
    expect(fake.client.files.pickSave).toHaveBeenCalledWith(
      expect.objectContaining({ defaultName: "b.md" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar todos…" }));
    await waitFor(() => expect(fake.client.files.writeText).toHaveBeenCalledTimes(3));
    expect(fake.client.files.pickSave).toHaveBeenCalledTimes(3);
    expect(fake.client.files.writeText).toHaveBeenCalledWith("save-2", `# a.html\n\n${TABLE}`);
    expect(fake.client.files.writeText).toHaveBeenCalledWith("save-3", `# b.csv\n\n${TABLE}`);
    expect(await screen.findByText("Archivos guardados: 2")).toBeInTheDocument();
  });

  it("sanea el HTML renderizado y quita el origen remoto de imágenes", () => {
    const host = document.createElement("div");
    host.innerHTML = renderMarkdown(
      '<script>alert(1)</script><img src="https://example.invalid/x" onerror="alert(1)"><b onclick="x()">texto</b>',
    );
    expect(host.querySelector("script")).toBeNull();
    expect(host.querySelector("img")?.hasAttribute("src")).toBe(false);
    expect(host.querySelector("img")?.hasAttribute("onerror")).toBe(false);
    expect(host.querySelector("b")?.hasAttribute("onclick")).toBe(false);
  });

  it("tiene las claves de error del backend en los dos idiomas", () => {
    for (const code of ["E_UNSUPPORTED_FORMAT", "E_PDF_NO_TEXT", "E_TOO_LARGE", "E_CANCELLED"]) {
      expect(es.errors[code as keyof typeof es.errors]).toBeTruthy();
      expect(en.errors[code as keyof typeof en.errors]).toBeTruthy();
    }
  });
});
