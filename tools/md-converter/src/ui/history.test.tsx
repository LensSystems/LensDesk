import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { App } from "./App.tsx";

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

it("cancelar conserva la cola y confirmar la vacía sin guardar archivos", async () => {
  const client = setup();
  await screen.findByRole("heading", { name: "Resultado" });
  expect(screen.getByRole("heading", { name: "Archivos convertidos · 1" })).toBeInTheDocument();
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
  await screen.findByText("No se pudo completar la acción (E_INTERNAL).");
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
