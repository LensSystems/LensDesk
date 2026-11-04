import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { NotePreview } from "./NotePreview.tsx";

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "es", resources: { es: { translation: es }, en: { translation: en } } });
});

it("copia solo el código del mismo bloque y restablece cada botón a los dos segundos", async () => {
  vi.useFakeTimers();
  try {
    const copy = vi.fn(async () => {});
    render(
      <NotePreview
        body={'```ts\nconst x = "<uno>";\n```\n*Comentario*\n\n```\notro\n```'}
        onCopyCode={copy}
      />,
    );
    const [first, second] = screen.getAllByRole("button", { name: "Copiar código" });
    if (!first || !second) throw new Error("Botones ausentes");
    await act(async () => fireEvent.click(first));
    expect(copy).toHaveBeenLastCalledWith('const x = "<uno>";\n');
    expect(first).toHaveTextContent("Copiado");
    expect(second).toHaveAttribute("aria-label", "Copiar código");
    act(() => vi.advanceTimersByTime(1000));
    await act(async () => fireEvent.click(second));
    expect(copy).toHaveBeenLastCalledWith("otro\n");
    act(() => vi.advanceTimersByTime(1000));
    expect(first).toHaveAttribute("aria-label", "Copiar código");
    expect(second).toHaveTextContent("Copiado");
    act(() => vi.advanceTimersByTime(1000));
    expect(second).toHaveAttribute("aria-label", "Copiar código");
  } finally {
    vi.useRealTimers();
  }
});

it("no confirma una copia rechazada y actualiza el idioma en vivo", async () => {
  const copy = vi.fn(async () => {
    throw new Error("Rechazado");
  });
  render(<NotePreview body={"```\nx\n```"} onCopyCode={copy} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copiar código" })));
  expect(screen.queryByRole("button", { name: "Copiado" })).toBeNull();
  await act(async () => {
    await i18n.changeLanguage("en");
  });
  expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
  await act(async () => {
    await i18n.changeLanguage("es");
  });
});

it("vuelve a «Copiar código» aunque se renderice de nuevo durante la confirmación", async () => {
  vi.useFakeTimers();
  try {
    const body = "```\nx\n```";
    const { rerender } = render(<NotePreview body={body} onCopyCode={async () => {}} />);
    const button = screen.getByRole("button", { name: "Copiar código" });
    await act(async () => fireEvent.click(button));
    expect(button).toHaveTextContent("Copiado");
    rerender(<NotePreview body={body} onCopyCode={async () => {}} />);
    act(() => vi.advanceTimersByTime(2000));
    expect(button).toHaveAttribute("aria-label", "Copiar código");
  } finally {
    vi.useRealTimers();
  }
});

it("ignora botones de copiar escritos en el HTML de la nota", async () => {
  const copy = vi.fn(async () => {});
  render(
    <NotePreview
      body={
        '<figure class="ld-code-block"><button data-copy-code>Falso</button><pre><code>echo seguro<span style="display:none">; rm -rf ~</span></code></pre></figure>'
      }
      onCopyCode={copy}
    />,
  );
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Falso" })));
  expect(copy).not.toHaveBeenCalled();
});

it("mantiene secretos fuera del DOM y copia desde memoria; ignora controles falsos", async () => {
  const copy = vi.fn(async () => {});
  const { container } = render(
    <NotePreview
      privateNote
      body={
        '```credential\nuser: Ada\npassword: secreto-unico\nsecret: PIN | 9876\n```\n<button data-credential="falso" data-field="1">Falso</button>'
      }
      onCopyCode={copy}
    />,
  );
  expect(container.innerHTML).not.toContain("secreto-unico");
  expect(container.innerHTML).not.toContain("9876");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Falso" })));
  expect(copy).not.toHaveBeenCalled();
  const copyPassword = screen.getByRole("button", { name: "Copiar Contraseña" });
  if (!copyPassword) throw new Error("Falta el botón de copiar");
  await act(async () => fireEvent.click(copyPassword));
  expect(copy).toHaveBeenLastCalledWith("secreto-unico");
  expect(container.innerHTML).not.toContain("secreto-unico");
  const reveal = screen.getByRole("button", { name: "Mostrar Contraseña" });
  if (!reveal) throw new Error("Falta el ojo");
  fireEvent.click(reveal);
  expect(container.textContent).toContain("secreto-unico");
  fireEvent.click(screen.getByRole("button", { name: "Ocultar Contraseña" }));
  expect(container.innerHTML).not.toContain("secreto-unico");
  expect(screen.queryByRole("button", { name: "Copiar código" })).toBeNull();
});

it("confirma la copia de un campo durante exactamente dos segundos sin revelar el secreto", async () => {
  vi.useFakeTimers();
  try {
    const { container } = render(
      <NotePreview
        privateNote
        body={"```credential\npassword: secreto-temporal\n```"}
        onCopyCode={async () => {}}
      />,
    );
    const button = screen.getByRole("button", { name: "Copiar Contraseña" });
    if (!button) throw new Error("Falta el botón de copiar");
    await act(async () => fireEvent.click(button));
    expect(button).toHaveTextContent("Copiado");
    expect(container.innerHTML).not.toContain("secreto-temporal");
    act(() => vi.advanceTimersByTime(1999));
    expect(button).toHaveTextContent("Copiado");
    act(() => vi.advanceTimersByTime(1));
    expect(button).toHaveAttribute("aria-label", "Copiar Contraseña");
    expect(button).not.toHaveTextContent("Copiado");
  } finally {
    vi.useRealTimers();
  }
});

it("la fila Notas no tiene controles de copiar ni mostrar", () => {
  render(
    <NotePreview
      privateNote
      body={"```credential\nuser: Ada\npassword: secreta\nnote: Acceso local\n```"}
      onCopyCode={vi.fn(async () => {})}
    />,
  );
  expect(screen.getByText("Acceso local").parentElement?.querySelector("button")).toBeNull();
  expect(screen.queryByRole("button", { name: "Copiar Notas" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Mostrar Notas" })).toBeNull();
  expect(screen.getByRole("button", { name: "Copiar Usuario" })).toBeInTheDocument();
});

it("anuncia el rechazo sin revelar código y permite reintentar desde el mismo botón", async () => {
  const copy = vi
    .fn()
    .mockRejectedValueOnce(new Error("secreto-sintetico"))
    .mockResolvedValue(undefined);
  const { container } = render(
    <NotePreview
      privateNote
      body={"```credential\npassword: secreto-sintetico\n```"}
      onCopyCode={copy}
    />,
  );
  const button = screen.getByRole("button", { name: "Copiar Contraseña" });
  act(() => button.focus());
  await act(async () => fireEvent.click(button));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No se pudo copiar. Vuelve a pulsar el botón de copiar para intentarlo de nuevo.",
  );
  expect(container.innerHTML).not.toContain("secreto-sintetico");
  expect(button).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Copiado" })).toBeNull();
  await act(async () => fireEvent.click(button));
  expect(button).toHaveAccessibleName("Copiado");
  expect(screen.queryByRole("alert")).toBeNull();
});

it.each([false, true])(
  "retira Copiado al rechazar una nueva copia; credencial=%s",
  async (privateNote) => {
    const copy = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("private"));
    render(
      <NotePreview
        privateNote={privateNote}
        body={
          privateNote
            ? "```credential\npassword: dato-sintetico\n```"
            : "```\ncodigo-sintetico\n```"
        }
        onCopyCode={copy}
      />,
    );
    const button = screen.getByRole("button", {
      name: privateNote ? "Copiar Contraseña" : "Copiar código",
    });
    await act(async () => fireEvent.click(button));
    expect(button).toHaveAccessibleName("Copiado");
    await act(async () => fireEvent.click(button));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copiado" })).toBeNull();
  },
);

it.each([false, true])(
  "ignora respuesta tardía en una credencial nueva con el mismo HTML; rechazo=%s",
  async (reject) => {
    let finish!: () => void;
    const copy = vi.fn(
      () =>
        new Promise<void>((resolve, fail) => {
          finish = () => (reject ? fail(new Error("anterior-sintetico")) : resolve());
        }),
    );
    const { rerender, container } = render(
      <NotePreview
        privateNote
        body={"```credential\npassword: anterior-sintetico\n```"}
        onCopyCode={copy}
      />,
    );
    const button = screen.getByRole("button", { name: "Copiar Contraseña" });
    fireEvent.click(button);
    rerender(
      <NotePreview
        privateNote
        body={"```credential\npassword: siguiente-sintetico\n```"}
        onCopyCode={copy}
      />,
    );
    expect(screen.getByRole("button", { name: "Copiar Contraseña" })).toBe(button);
    await act(async () => finish());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copiado" })).toBeNull();
    expect(container.innerHTML).not.toContain("anterior-sintetico");
    expect(container.innerHTML).not.toContain("siguiente-sintetico");
  },
);

it("ignora la copia pendiente al desmontar una nota antes de mostrar otra", async () => {
  let finish!: () => void;
  const copy = () =>
    new Promise<void>((resolve) => {
      finish = resolve;
    });
  const { rerender } = render(
    <NotePreview key="anterior" body={"```\nanterior\n```"} onCopyCode={copy} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
  rerender(<NotePreview key="siguiente-bloqueada" body="Nota bloqueada" onCopyCode={copy} />);
  await act(async () => finish());
  expect(screen.getByText("Nota bloqueada")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("button", { name: "Copiado" })).toBeNull();
});

it("una copia anterior tardía no oculta el fallo de la última acción en otro botón", async () => {
  let finishFirst!: () => void;
  const copy = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
    )
    .mockRejectedValueOnce(new Error("private"));
  render(<NotePreview body={"```\nprimero\n```\n\n```\nsegundo\n```"} onCopyCode={copy} />);
  const [first, second] = screen.getAllByRole("button", { name: "Copiar código" });
  if (!first || !second) throw new Error("Botones ausentes");
  fireEvent.click(first);
  await act(async () => fireEvent.click(second));
  expect(screen.getByRole("alert")).toBeTruthy();
  await act(async () => finishFirst());
  expect(first).toHaveAccessibleName("Copiado");
  expect(second).toHaveAccessibleName("Copiar código");
  expect(screen.getByRole("alert")).toBeTruthy();
});
