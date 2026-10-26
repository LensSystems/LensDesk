import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { createToolClient, SpellingInfo } from "@lensdesk/sdk";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditorMenu } from "./EditorMenu.tsx";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => vi.useRealTimers());
function setup(readOnly = false, spellcheck = true, hasRange = true) {
  const editor = {
    state: EditorState.create({ doc: "holaa holaa" }),
    posAtCoords: vi.fn((): number | null => (hasRange ? 8 : null)),
    coordsAtPos: vi.fn(() => ({ left: 10, bottom: 20 })),
    dom: document.createElement("div"),
    focus: vi.fn(),
    dispatch: vi.fn(),
  };
  let emit: (info: SpellingInfo) => void = () => {};
  const stop = vi.fn();
  const client = {
    app: {
      onSpelling: (callback: typeof emit) => {
        emit = callback;
        return stop;
      },
    },
  } as unknown as ReturnType<typeof createToolClient>;
  const result = render(
    <EditorMenu
      client={client}
      spellcheck={spellcheck}
      readOnly={readOnly}
      view={{ current: editor as unknown as EditorView }}
    >
      <button type="button">Editor</button>
    </EditorMenu>,
  );
  return {
    ...result,
    editor,
    emit: (info: SpellingInfo) => act(() => emit(info)),
    stop,
    click: () => fireEvent.contextMenu(screen.getByRole("button"), { clientX: 10, clientY: 20 }),
  };
}
it("espera el clic, muestra sugerencias y limpia la suscripción", () => {
  const test = setup();
  test.emit({ word: "holaa", suggestions: ["hola"] });
  expect(screen.queryByRole("menu")).toBeNull();
  test.click();
  expect(screen.queryByRole("menu")).toBeNull();
  test.emit({ word: "holaa", suggestions: ["hola"] });
  expect(screen.getByRole("menuitem", { name: "hola" })).toBeTruthy();
  expect(screen.getByText("spelling.title")).toBeTruthy();
  expect(screen.getAllByRole("menuitem")[0]).toHaveTextContent("hola");
  expect(screen.getAllByRole("menuitem")[1]).toHaveTextContent("undo");
  test.unmount();
  expect(test.stop).toHaveBeenCalledOnce();
});
it("muestra una opción deshabilitada sin sugerencias", () => {
  const test = setup();
  test.click();
  test.emit({ word: "holaa", suggestions: [] });
  expect(
    screen.getByRole("menuitem", { name: "spelling.none" }).getAttribute("data-disabled"),
  ).not.toBeNull();
});
it("abre sin grupo al agotarse el tiempo e ignora avisos tardíos", () => {
  vi.useFakeTimers();
  const test = setup();
  test.click();
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByRole("menu")).toBeTruthy();
  test.emit({ word: "holaa", suggestions: ["hola"] });
  expect(screen.queryByText("spelling.title")).toBeNull();
});
it("abre sin grupo para una palabra vacía", () => {
  const test = setup();
  test.click();
  test.emit({ word: "", suggestions: [] });
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(screen.queryByText("spelling.title")).toBeNull();
});

it("deshabilita las sugerencias en solo lectura", () => {
  const test = setup(true);
  test.click();
  test.emit({ word: "holaa", suggestions: ["hola"] });
  expect(
    screen.getByRole("menuitem", { name: "hola" }).getAttribute("data-disabled"),
  ).not.toBeNull();
});
it("sin corrector abre directamente y no se suscribe", () => {
  const test = setup(false, false);
  test.click();
  expect(screen.getByRole("menu")).toBeTruthy();
  test.emit({ word: "holaa", suggestions: ["hola"] });
  expect(screen.queryByText("spelling.title")).toBeNull();
  test.unmount();
  expect(test.stop).not.toHaveBeenCalled();
});
it("cancela la apertura pendiente al desmontarse", () => {
  vi.useFakeTimers();
  const test = setup();
  test.click();
  test.unmount();
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByRole("menu")).toBeNull();
  expect(test.stop).toHaveBeenCalledOnce();
});

it.each(["Escape", "a"])("cancela la espera con la tecla %s", (key) => {
  vi.useFakeTimers();
  const test = setup();
  test.click();
  fireEvent.keyDown(screen.getByRole("button"), { key });
  test.emit({ word: "holaa", suggestions: ["hola"] });
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByRole("menu")).toBeNull();
});
it("cancela al pulsar fuera del editor", () => {
  vi.useFakeTimers();
  const test = setup();
  test.click();
  fireEvent.pointerDown(document.body);
  test.emit({ word: "holaa", suggestions: ["hola"] });
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByRole("menu")).toBeNull();
});
it("Mayús+F10 abre una sola vez y cancela la espera anterior", () => {
  vi.useFakeTimers();
  const test = setup();
  test.click();
  fireEvent.keyDown(screen.getByRole("button"), { key: "F10", shiftKey: true });
  expect(screen.getByRole("menu")).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  test.emit({ word: "holaa", suggestions: ["hola"] });
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByRole("menu")).toBeNull();
});
it.each(["editor", "window"])("cancela al perder foco: %s", (target) => {
  vi.useFakeTimers();
  const test = setup();
  test.click();
  fireEvent.blur(target === "editor" ? test.editor.dom : window);
  test.emit({ word: "holaa", suggestions: ["hola"] });
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByRole("menu")).toBeNull();
});
it("deshabilita sugerencias sin rango original", () => {
  const test = setup(false, true, false);
  test.click();
  test.emit({ word: "holaa", suggestions: ["hola"] });
  expect(screen.getByRole("menuitem", { name: "hola" })).toHaveAttribute("data-disabled");
});
it("captura el rango antes de recibir sugerencias", () => {
  const test = setup();
  test.click();
  test.editor.posAtCoords.mockReturnValue(2);
  test.emit({ word: "holaa", suggestions: ["hola"] });
  fireEvent.click(screen.getByRole("menuitem", { name: "hola" }));
  expect(test.editor.dispatch).toHaveBeenCalledWith({
    changes: { from: 6, to: 11, insert: "hola" },
    userEvent: "input.spelling",
  });
  expect(test.editor.posAtCoords).toHaveBeenCalledOnce();
});
