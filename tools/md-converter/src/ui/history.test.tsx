import { TooltipProvider } from "@lensdesk/ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import { Preview } from "./Preview.tsx";
import type { QueueItem } from "./use-queue.ts";

function setup() {
  const client = {
    backend: { invoke: vi.fn(async () => ({ markdown: "# Resultado", warnings: [] })) },
    files: {
      pickOpen: vi.fn(async () => [{ token: "input", name: "a.html", size: 1 }]),
      pickSave: vi.fn(
        async (): Promise<{ token: string; name: string; size: number } | null> => ({
          token: "output",
          name: "a.md",
          size: 0,
        }),
      ),
      writeText: vi.fn(async () => {}),
      onDrop: vi.fn(() => () => {}),
    },
    ui: { copyText: vi.fn(async () => {}) },
    app: {
      getContext: vi.fn(async () => ({ locale: "es", theme: "dark" })),
      onContextChange: vi.fn(() => () => {}),
    },
  };
  render(<App client={client as never} />);
  fireEvent.click(screen.getByRole("button", { name: es.chooseFiles }));
  return client;
}

beforeEach(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: "es",
    interpolation: { escapeValue: false },
  });
});
afterEach(() => vi.useRealTimers());

it.each([0, 1])("detiene Guardar todos al cancelar el selector %s", async (cancelAt) => {
  const results = ["a", "b", "c"].map(
    (id): QueueItem => ({
      id,
      file: { token: id, name: `${id}.html`, size: 1 },
      status: "done",
      markdown: `# ${id}`,
      warnings: [],
      progress: 1,
      errorCode: "",
    }),
  );
  let picked = 0;
  const client = {
    files: {
      pickSave: vi.fn(async () => (picked++ === cancelAt ? null : { token: "output" })),
      writeText: vi.fn(async () => {}),
    },
  };
  const saved = vi.fn();
  render(
    <Preview
      client={client as never}
      item={results[0] ?? null}
      results={results}
      onSaved={saved}
    />,
    { wrapper: TooltipProvider },
  );
  await act(async () => fireEvent.click(screen.getByRole("button", { name: es.saveAll })));
  expect(client.files.pickSave).toHaveBeenCalledTimes(cancelAt + 1);
  expect(client.files.writeText).toHaveBeenCalledTimes(cancelAt);
  expect(saved.mock.calls.map(([id]) => id)).toEqual(
    results.slice(0, cancelAt).map((result) => result.id),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    `Guardado detenido. Se guardaron ${cancelAt} de 3 archivos.`,
  );
  expect(screen.queryByRole("alert")).toBeNull();
});

it("captura el lote, conserva el foco y evita doble activación hasta resolver el selector", async () => {
  const results = ["a", "b", "c"].map(
    (id): QueueItem => ({
      id,
      file: { token: id, name: `${id}.html`, size: 1 },
      status: "done",
      markdown: `# ${id}`,
      warnings: [],
      progress: 1,
      errorCode: "",
    }),
  );
  let finish!: (value: { token: string } | null) => void;
  const client = {
    files: {
      pickSave: vi.fn(
        () =>
          new Promise<{ token: string } | null>((resolve) => {
            finish = resolve;
          }),
      ),
      writeText: vi.fn(async () => {}),
    },
  };
  const saved = vi.fn();
  const { rerender } = render(
    <Preview
      client={client as never}
      item={results[0] ?? null}
      results={results}
      onSaved={saved}
    />,
    { wrapper: TooltipProvider },
  );
  const all = screen.getByRole("button", { name: es.saveAll });
  act(() => all.focus());
  fireEvent.click(all);
  fireEvent.click(all);
  fireEvent.click(screen.getByRole("button", { name: es.save }));
  expect(client.files.pickSave).toHaveBeenCalledOnce();
  expect(all).toHaveFocus();
  expect(all).toHaveAttribute("aria-disabled", "true");
  expect(all).toHaveAttribute("aria-busy", "true");
  expect(screen.getByText("Guardando archivos…").closest('[aria-busy="true"]')).toBeNull();
  rerender(
    <Preview
      client={client as never}
      item={results[1] ?? null}
      results={results.concat(results.map((result) => ({ ...result, id: `new-${result.id}` })))}
      onSaved={saved}
    />,
  );
  await act(async () => finish(null));
  expect(screen.getByRole("status")).toHaveTextContent(
    "Guardado detenido. Se guardaron 0 de 3 archivos.",
  );
  expect(all).toHaveAttribute("aria-busy", "false");
  expect(all).toHaveAttribute("aria-disabled", "false");
  fireEvent.click(screen.getByRole("button", { name: es.save }));
  await act(async () => finish({ token: "individual" }));
  expect(client.files.writeText).toHaveBeenCalledWith("individual", "# b");
  expect(saved).toHaveBeenCalledExactlyOnceWith("b");
});

it("detiene el lote al fallar una escritura y solo marca lo escrito con éxito", async () => {
  const results = ["a", "b", "c"].map(
    (id): QueueItem => ({
      id,
      file: { token: id, name: `${id}.html`, size: 1 },
      status: "done",
      markdown: `# ${id}`,
      warnings: [],
      progress: 1,
      errorCode: "",
    }),
  );
  const client = {
    files: {
      pickSave: vi.fn(async () => ({ token: "output" })),
      writeText: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("private path"))
        .mockResolvedValue(undefined),
    },
  };
  const saved = vi.fn();
  render(
    <Preview
      client={client as never}
      item={results[1] ?? null}
      results={results}
      onSaved={saved}
    />,
    { wrapper: TooltipProvider },
  );
  const all = screen.getByRole("button", { name: es.saveAll });
  await act(async () => fireEvent.click(all));
  expect(client.files.pickSave).toHaveBeenCalledTimes(2);
  expect(saved).toHaveBeenCalledExactlyOnceWith("a");
  expect(screen.getByRole("alert")).toHaveTextContent("Se guardaron 1 de 3 archivos");
  expect(screen.getByRole("alert")).not.toHaveTextContent("private path");
  expect(all).toHaveAttribute("aria-busy", "false");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: es.save })));
  expect(saved).toHaveBeenLastCalledWith("b");
});

it.each([false, true])(
  "iniciar un lote retira el error de guardado individual; cancelado=%s",
  async (cancel) => {
    const result: QueueItem = {
      id: "a",
      file: { token: "a", name: "a.html", size: 1 },
      status: "done",
      markdown: "# a",
      warnings: [],
      progress: 1,
      errorCode: "",
    };
    const client = {
      files: {
        pickSave: vi
          .fn()
          .mockResolvedValueOnce({ token: "individual" })
          .mockResolvedValueOnce(cancel ? null : { token: "batch" }),
        writeText: vi.fn().mockRejectedValueOnce(new Error("private")).mockResolvedValue(undefined),
      },
    };
    const saved = vi.fn();
    render(<Preview client={client as never} item={result} results={[result]} onSaved={saved} />, {
      wrapper: TooltipProvider,
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: es.save })));
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar el archivo Markdown");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: es.saveAll })));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      cancel ? "Guardado detenido. Se guardaron 0 de 1 archivos." : "Se guardaron 1 de 1 archivos.",
    );
    expect(saved).toHaveBeenCalledTimes(cancel ? 0 : 1);
  },
);

it("ignora un fallo individual antiguo mientras un lote está pendiente y traduce el resumen al idioma activo", async () => {
  const result: QueueItem = {
    id: "a",
    file: { token: "a", name: "a.html", size: 1 },
    status: "done",
    markdown: "# a",
    warnings: [],
    progress: 1,
    errorCode: "",
  };
  let failIndividual!: () => void;
  let cancelBatch!: () => void;
  const client = {
    files: {
      pickSave: vi
        .fn()
        .mockResolvedValueOnce({ token: "individual" })
        .mockImplementationOnce(
          () =>
            new Promise<null>((resolve) => {
              cancelBatch = () => resolve(null);
            }),
        ),
      writeText: vi.fn(
        () =>
          new Promise<void>((_, fail) => {
            failIndividual = () => fail(new Error("private"));
          }),
      ),
    },
  };
  const results = Array.from({ length: 1000 }, (_, index) => ({ ...result, id: `item-${index}` }));
  render(<Preview client={client as never} item={result} results={results} onSaved={vi.fn()} />, {
    wrapper: TooltipProvider,
  });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: es.save })));
  fireEvent.click(screen.getByRole("button", { name: es.saveAll }));
  await act(async () => failIndividual());
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Guardando archivos…");
  await act(async () => i18n.changeLanguage("en"));
  expect(screen.getByRole("status")).toHaveTextContent("Saving files…");
  await act(async () => cancelBatch());
  expect(screen.getByRole("status")).toHaveTextContent("Saving stopped. Saved 0 of 1,000 files.");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("cancelar conserva la cola y confirmar la vacía sin guardar archivos", async () => {
  const client = setup();
  await screen.findByRole("heading", { name: "Resultado" });
  expect(screen.getByRole("heading", { name: "Archivos · 1" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: es.clearHistory }));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("Los archivos .md que ya guardaste no se borran.");
  fireEvent.click(within(dialog).getByRole("button", { name: es.cancel }));
  expect(screen.getByRole("button", { name: "a.html" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: es.clearHistory }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: es.clearHistory }),
  );
  expect(screen.queryByRole("button", { name: "a.html" })).toBeNull();
  expect(screen.getByText(es.emptyQueue)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: es.save })).toBeDisabled();
  expect(client.files.pickSave).not.toHaveBeenCalled();
  expect(client.files.writeText).not.toHaveBeenCalled();
});

it("muestra el indicador solo después de escribir, no al cancelar ni al fallar", async () => {
  const client = setup();
  await screen.findByRole("heading", { name: "Resultado" });
  expect(screen.queryByRole("img", { name: es.fileSaved })).toBeNull();
  client.files.pickSave.mockResolvedValueOnce(null);
  fireEvent.click(screen.getByRole("button", { name: es.save }));
  await waitFor(() => expect(client.files.pickSave).toHaveBeenCalledOnce());
  expect(screen.queryByText(/Archivos guardados:/)).toBeNull();
  expect(screen.queryByRole("img", { name: es.fileSaved })).toBeNull();
  client.files.writeText.mockRejectedValueOnce(new Error("failed"));
  fireEvent.click(screen.getByRole("button", { name: es.save }));
  await screen.findByText(
    "No se pudo guardar el archivo Markdown. Vuelve a pulsar Guardar .md para intentarlo de nuevo.",
  );
  expect(screen.queryByRole("img", { name: es.fileSaved })).toBeNull();
  let finish = () => {};
  client.files.writeText.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: es.save }));
  await waitFor(() => expect(client.files.writeText).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("img", { name: es.fileSaved })).toBeNull();
  await act(async () => finish());
  expect(screen.getByRole("img", { name: es.fileSaved })).toBeInTheDocument();
});

it("confirma la copia con Check durante dos segundos", async () => {
  const client = setup();
  await screen.findByRole("heading", { name: "Resultado" });
  vi.useFakeTimers();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: es.copy })));
  expect(client.ui.copyText).toHaveBeenCalledWith("# Resultado");
  expect(screen.getByRole("button", { name: es.copied })).toHaveClass("copy-confirmation");
  expect(
    screen.getByRole("button", { name: es.copied }).querySelector(".lucide-check"),
  ).toBeTruthy();
  act(() => vi.advanceTimersByTime(1999));
  expect(screen.getByRole("button", { name: es.copied })).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("button", { name: es.copy })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: es.copied })).toBeNull();
});
