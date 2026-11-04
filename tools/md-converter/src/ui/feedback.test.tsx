import { TooltipProvider } from "@lensdesk/ui";
import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeEach, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { Preview } from "./Preview.tsx";
import { Queue } from "./Queue.tsx";
import type { QueueItem, QueueStatus } from "./use-queue.ts";

const item = (id: string, status: QueueStatus = "done"): QueueItem => ({
  id,
  status,
  markdown: `# ${id}`,
  warnings: [],
  errorCode: "E_INTERNAL",
  progress: 0,
  file: { token: id, name: `${id}.html`, size: 1 },
});
beforeEach(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "es", resources: { es: { translation: es }, en: { translation: en } } });
});

it("explica el fallo de copia mediante una alerta sin detalles crudos", async () => {
  render(
    <Preview
      client={{ ui: { copyText: vi.fn().mockRejectedValue(new Error("private-detail")) } } as never}
      item={item("A")}
      results={[]}
      onSaved={vi.fn()}
    />,
    { wrapper: TooltipProvider },
  );
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copiar" })));
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo copiar el Markdown");
  expect(screen.getByRole("alert")).not.toHaveTextContent("private-detail");
});

it.each([false, true])(
  "ignora la respuesta de copia de A después de seleccionar B; rechazo=%s",
  async (reject) => {
    let finish!: () => void;
    const client = {
      ui: {
        copyText: () =>
          new Promise<void>((resolve, fail) => {
            finish = () => (reject ? fail(new Error("old")) : resolve());
          }),
      },
    };
    const props = { client: client as never, results: [], onSaved: vi.fn() };
    const { rerender } = render(<Preview {...props} item={item("A")} />, {
      wrapper: TooltipProvider,
    });
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    rerender(<Preview {...props} item={item("B")} />);
    await act(async () => finish());
    expect(screen.queryByRole("button", { name: "Copiado" })).toBeNull();
    expect(screen.queryByText(/No se pudo/)).toBeNull();
  },
);

it("llama Archivos al total de una cola con cinco estados", () => {
  const items = (["queued", "converting", "done", "error", "cancelled"] as const).map((status) =>
    item(status, status),
  );
  render(
    <Queue
      items={items}
      selectedId="done"
      onChoose={vi.fn()}
      onSelect={vi.fn()}
      onCancel={vi.fn()}
      onClear={vi.fn()}
    />,
    { wrapper: TooltipProvider },
  );
  expect(screen.getByRole("heading", { name: "Archivos · 5" })).toBeTruthy();
});

it.each(["save", "saveAll"] as const)(
  "explica el fallo de %s y mantiene disponible la recuperación",
  async (action) => {
    const result = item("A");
    const client = {
      files: {
        pickSave: vi
          .fn()
          .mockRejectedValueOnce(new Error("private-detail"))
          .mockResolvedValue({ token: "output" }),
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    };
    const saved = vi.fn();
    render(<Preview client={client as never} item={result} results={[result]} onSaved={saved} />, {
      wrapper: TooltipProvider,
    });
    const button = screen.getByRole("button", { name: es[action] });
    act(() => button.focus());
    await act(async () => fireEvent.click(button));
    expect(screen.getByRole("alert")).toHaveTextContent(
      action === "save"
        ? "No se pudo guardar el archivo Markdown"
        : "No se pudieron guardar todos los archivos Markdown",
    );
    expect(button).toHaveFocus();
    expect(saved).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(button));
    expect(saved).toHaveBeenCalledWith("A");
    expect(screen.queryByRole("alert")).toBeNull();
  },
);

it("mantiene informativo el aviso de imágenes omitidas", () => {
  render(
    <Preview
      client={{} as never}
      item={{ ...item("A"), warnings: ["images"] }}
      results={[]}
      onSaved={vi.fn()}
    />,
    { wrapper: TooltipProvider },
  );
  expect(screen.getByRole("status")).toHaveTextContent(es.imagesOmitted);
  expect(screen.queryByRole("alert")).toBeNull();
});

it("no restaura Copiado ni errores antiguos al volver de B a A", async () => {
  let finish!: () => void;
  const client = {
    ui: {
      copyText: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    },
  };
  const props = { client: client as never, results: [], onSaved: vi.fn() };
  const { rerender, unmount } = render(<Preview {...props} item={item("A")} />, {
    wrapper: TooltipProvider,
  });
  fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
  rerender(<Preview {...props} item={item("B")} />);
  rerender(<Preview {...props} item={item("A")} />);
  await act(async () => finish());
  expect(screen.queryByRole("button", { name: "Copiado" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
  unmount();
  await act(async () => finish());
  expect(screen.queryByRole("alert")).toBeNull();
});

it("mantiene la copia vinculada al id al reordenar los resultados", async () => {
  let finish!: () => void;
  const client = {
    ui: {
      copyText: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    },
  };
  const a = item("A"),
    b = item("B");
  const props = { client: client as never, item: a, onSaved: vi.fn() };
  const { rerender } = render(<Preview {...props} results={[a, b]} />, {
    wrapper: TooltipProvider,
  });
  fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
  rerender(<Preview {...props} results={[b, a]} />);
  await act(async () => finish());
  expect(screen.getByRole("button", { name: "Copiado" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "A" })).toBeTruthy();
});
